import { useCallback } from "react";

export default function useInboxSupportActions({
  apiUrl,
  token,
  activeChat,
  copilot,
  emailDraft,
  setIsCreatingTicket,
  setIsSubmittingEmail,
  setShowEmailModal,
  setEmailDraft,
  setActiveChat,
  setShowDetailsRail,
  setShowMergeModal,
  loadConversations,
  defaultEmailDraft,
}) {
  const handleCreateTicket = useCallback(async () => {
    if (!activeChat) return;

    setIsCreatingTicket(true);
    try {
      const payload = {
        conversation_id: activeChat.id,
        customer_id: activeChat.customer_id,
        title: `Issue reported by ${activeChat.customer_name}`,
        description: copilot.summary || "No summary available.",
        priority: "medium",
        status: "open",
      };

      const res = await fetch(`${apiUrl}/api/protected/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        window.alert(
          "Ticket created successfully. Check the ticket board for follow-up.",
        );
      } else {
        window.alert("Failed to create ticket.");
      }
    } catch (err) {
      console.error("Error creating ticket", err);
    } finally {
      setIsCreatingTicket(false);
    }
  }, [activeChat, apiUrl, copilot.summary, setIsCreatingTicket, token]);

  const handleSimulateEmail = useCallback(
    async (event) => {
      event.preventDefault();
      if (
        !emailDraft.name.trim() ||
        !emailDraft.email.trim() ||
        !emailDraft.subject.trim() ||
        !emailDraft.content.trim()
      ) {
        return;
      }

      setIsSubmittingEmail(true);
      try {
        const res = await fetch(`${apiUrl}/api/protected/conversations/email-sim`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: emailDraft.name.trim(),
            email: emailDraft.email.trim(),
            subject: emailDraft.subject.trim(),
            content: emailDraft.content.trim(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setShowEmailModal(false);
          setEmailDraft({ ...defaultEmailDraft });
          await loadConversations();
          if (data?.conversation) {
            setActiveChat(data.conversation);
            setShowDetailsRail(true);
          }
        } else {
          const text = await res.text();
          window.alert(text || "Failed to simulate email conversation.");
        }
      } catch (err) {
        console.error("Failed to simulate email conversation", err);
      } finally {
        setIsSubmittingEmail(false);
      }
    },
    [
      apiUrl,
      defaultEmailDraft,
      emailDraft.content,
      emailDraft.email,
      emailDraft.name,
      emailDraft.subject,
      loadConversations,
      setActiveChat,
      setEmailDraft,
      setIsSubmittingEmail,
      setShowDetailsRail,
      setShowEmailModal,
      token,
    ],
  );

  const handleMergeConversation = useCallback(
    async (targetId) => {
      if (!activeChat || targetId === activeChat.id) return;
      try {
        const res = await fetch(
          `${apiUrl}/api/protected/conversations/${activeChat.id}/merge`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ target_id: targetId }),
          },
        );
        if (res.ok) {
          setShowMergeModal(false);
          await loadConversations();
        }
      } catch (err) {
        console.error("Merge failed", err);
      }
    },
    [activeChat, apiUrl, loadConversations, setShowMergeModal, token],
  );

  return {
    handleCreateTicket,
    handleSimulateEmail,
    handleMergeConversation,
  };
}
