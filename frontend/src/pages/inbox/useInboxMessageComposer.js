import { useCallback } from "react";

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export default function useInboxMessageComposer({
  apiUrl,
  token,
  activeChat,
  messagePrompt,
  setMessagePrompt,
  isInternal,
  setIsInternal,
  attachment,
  setAttachment,
  isUploading,
  setIsUploading,
  setMessages,
  sendRealtimeEvent,
  typingTimeoutRef,
}) {
  const handleSendMessage = useCallback(
    async (overrideContent = null) => {
      const hasOverride = typeof overrideContent === "string";
      const contentToSend = hasOverride
        ? overrideContent.trim()
        : messagePrompt.trim();
      const attachmentToUpload = hasOverride ? null : attachment;
      const internalMode = hasOverride ? false : isInternal;

      if ((!contentToSend && !attachmentToUpload) || !activeChat || isUploading)
        return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      sendRealtimeEvent({ type: "typing", is_typing: false });
      setIsUploading(true);

      let uploadedFile = null;
      if (attachmentToUpload) {
        const formData = new FormData();
        formData.append("file", attachmentToUpload);
        try {
          const uploadRes = await fetch(`${apiUrl}/api/protected/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (uploadRes.ok) {
            uploadedFile = await uploadRes.json();
          } else {
            console.error("Failed to upload attachment");
            setIsUploading(false);
            return;
          }
        } catch (err) {
          console.error("Upload error", err);
          setIsUploading(false);
          return;
        }
      }

      const payload = { content: contentToSend };
      if (uploadedFile) {
        payload.attachment_url = uploadedFile.url;
        payload.attachment_name = uploadedFile.name;
        payload.attachment_type = uploadedFile.type;
      }

      try {
        const res = await fetch(
          `${apiUrl}/api/protected/conversations/${activeChat.id}/messages${internalMode ? "?is_internal=true" : ""}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
        );

        setIsUploading(false);
        if (res.ok) {
          const newMessage = await res.json();
          setMessages((prev) => {
            if (prev.find((message) => message.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
          if (hasOverride) {
            if (messagePrompt.trim() === contentToSend) {
              setMessagePrompt("");
            }
          } else {
            setMessagePrompt("");
            setAttachment(null);
            setIsInternal(false);
          }
        }
      } catch (err) {
        console.error("Failed to send message", err);
        setIsUploading(false);
      }
    },
    [
      activeChat,
      apiUrl,
      attachment,
      isInternal,
      isUploading,
      messagePrompt,
      sendRealtimeEvent,
      setAttachment,
      setIsInternal,
      setIsUploading,
      setMessagePrompt,
      setMessages,
      token,
      typingTimeoutRef,
    ],
  );

  const handleFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (file) {
        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
          alert("File is too large. Max size is 5MB.");
          return;
        }
        setAttachment(file);
      }
    },
    [setAttachment],
  );

  const handlePromptChange = useCallback(
    (event) => {
      const value = event.target.value;
      setMessagePrompt(value);

      if (isInternal) {
        return;
      }

      sendRealtimeEvent({ type: "typing", is_typing: value.trim().length > 0 });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendRealtimeEvent({ type: "typing", is_typing: false });
      }, 1200);
    },
    [isInternal, sendRealtimeEvent, setMessagePrompt, typingTimeoutRef],
  );

  return {
    handleSendMessage,
    handleFileChange,
    handlePromptChange,
  };
}
