import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ResizablePanels from "../components/ResizablePanels";
import ActiveConversationHeader from "./inbox/ActiveConversationHeader";
import EmailSimulationModal from "./inbox/EmailSimulationModal";
import InboxConversationRail from "./inbox/InboxConversationRail";
import InboxDetailsRail from "./inbox/InboxDetailsRail";
import MessageComposer from "./inbox/MessageComposer";
import MergeConversationModal from "./inbox/MergeConversationModal";
import MessageBubble from "./inbox/MessageBubble";
import useConversationThread from "./inbox/useConversationThread";
import useInboxCopilot from "./inbox/useInboxCopilot";
import useInboxConversationActions from "./inbox/useInboxConversationActions";
import useInboxConversationsLoader from "./inbox/useInboxConversationsLoader";
import useInboxConversationStream from "./inbox/useInboxConversationStream";
import useInboxDerivedData from "./inbox/useInboxDerivedData";
import useInboxMessageComposer from "./inbox/useInboxMessageComposer";
import useInboxPeople from "./inbox/useInboxPeople";
import useInboxSupportActions from "./inbox/useInboxSupportActions";
import { defaultEmailDraft } from "./inbox/inboxHelpers";
import useInboxViewState from "./inbox/useInboxViewState";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8900";

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messagePrompt, setMessagePrompt] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(() => ({
    ...defaultEmailDraft,
  }));
  const fileInputRef = useRef(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const { agents, customers } = useInboxPeople({
    apiUrl: API_URL,
    token,
  });

  const {
    filters,
    setFilters,
    showFilters,
    setShowFilters,
    showConversationRail,
    setShowConversationRail,
    showDetailsRail,
    setShowDetailsRail,
    availableTags,
    activeFilterCount,
    filterSummary,
    panelLayout,
    clearFilters,
  } = useInboxViewState({
    agents,
    conversations,
  });

  const { copilot } = useInboxCopilot({
    apiUrl: API_URL,
    token,
    activeChat,
  });

  const {
    messages,
    setMessages,
    typingNotice,
    wsState,
    isThreadLoading,
    sendRealtimeEvent,
    typingTimeoutRef,
  } = useConversationThread({
    apiUrl: API_URL,
    token,
    activeChat,
    setConversations,
    setActiveChat,
  });

  const { loadConversations } = useInboxConversationsLoader({
    apiUrl: API_URL,
    token,
    filters,
    navigate,
    setConversations,
    setActiveChat,
    setAccessError,
  });

  const {
    selectedConversations,
    isBulkActionLoading,
    bulkAssignAgentId,
    setBulkAssignAgentId,
    clearSelection,
    toggleSelectConversation,
    toggleSelectAll,
    handleBulkAction,
    handleUpdateConversation,
    handleAddTag,
    handleRemoveTag,
  } = useInboxConversationActions({
    apiUrl: API_URL,
    token,
    activeChat,
    setConversations,
    setActiveChat,
    loadConversations,
  });

  useInboxConversationStream({
    apiUrl: API_URL,
    token,
    filters,
    activeChatId: activeChat?.id,
    setConversations,
    setActiveChat,
  });

  const { handleSendMessage, handleFileChange, handlePromptChange } =
    useInboxMessageComposer({
      apiUrl: API_URL,
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
    });

  const { handleCreateTicket, handleSimulateEmail, handleMergeConversation } =
    useInboxSupportActions({
      apiUrl: API_URL,
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
    });

  const { activeCustomer, lastOutboundMessage } = useInboxDerivedData({
    customers,
    activeChat,
    messages,
  });

  return (
    <div className="app-main-surface h-full w-full overflow-hidden">
      <ResizablePanels
        storageKey={panelLayout.storageKey}
        initialSizes={panelLayout.initialSizes}
        minSizes={panelLayout.minSizes}
        className="h-full w-full"
        stackBelow={1180}
      >
        {showConversationRail && (
          <InboxConversationRail
            onShowEmailModal={() => setShowEmailModal(true)}
            onHideConversationRail={() => setShowConversationRail(false)}
            selectedCount={selectedConversations.size}
            isBulkActionLoading={isBulkActionLoading}
            onBulkResolve={() => handleBulkAction("resolve")}
            onBulkReopen={() => handleBulkAction("reopen")}
            onBulkSnooze={() => handleBulkAction("snooze")}
            agents={agents}
            bulkAssignAgentId={bulkAssignAgentId}
            onBulkAssignAgentIdChange={setBulkAssignAgentId}
            onBulkAssign={() =>
              handleBulkAction("assign", {
                assignee_id: bulkAssignAgentId,
              })
            }
            onClearSelection={clearSelection}
            accessError={accessError}
            filterSummary={filterSummary}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters((prev) => !prev)}
            activeFilterCount={activeFilterCount}
            filters={filters}
            setFilters={setFilters}
            availableTags={availableTags}
            onClearFilters={clearFilters}
            onToggleSelectAll={() => toggleSelectAll(conversations)}
            allSelected={selectedConversations.size === conversations.length}
            hasConversations={conversations.length > 0}
            conversations={conversations}
            activeChatId={activeChat?.id}
            selectedConversations={selectedConversations}
            onToggleSelectConversation={toggleSelectConversation}
            onSelectConversation={setActiveChat}
          />
        )}

        <div
          className="flex h-full min-h-0 min-w-0 flex-col"
          style={{ background: "color-mix(in srgb, var(--app-card) 96%, transparent)" }}
        >
          {activeChat ? (
            <>
              <ActiveConversationHeader
                key={activeChat.id}
                activeChat={activeChat}
                agents={agents}
                wsState={wsState}
                showConversationRail={showConversationRail}
                showDetailsRail={showDetailsRail}
                onToggleConversationRail={() =>
                  setShowConversationRail((prev) => !prev)
                }
                onToggleDetailsRail={() => setShowDetailsRail((prev) => !prev)}
                onOpenMerge={() => setShowMergeModal(true)}
                onUpdateConversation={handleUpdateConversation}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
              />

              <div
                className="flex-1 space-y-4 overflow-y-auto p-6"
                style={{ background: "color-mix(in srgb, var(--app-card-muted) 96%, transparent)" }}
              >
                {isThreadLoading ? (
                  <div className="app-empty-state px-5 py-4 text-sm">
                    Loading conversation...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="app-empty-state px-5 py-4 text-sm">
                    No messages in this conversation yet.
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      activeCustomerId={activeChat.customer_id}
                      apiUrl={API_URL}
                      lastOutboundMessageId={lastOutboundMessage?.id}
                      customerLastReadAt={activeChat.customer_last_read_at}
                    />
                  ))
                )}
              </div>

              <MessageComposer
                typingNotice={typingNotice}
                isInternal={isInternal}
                setIsInternal={setIsInternal}
                attachment={attachment}
                setAttachment={setAttachment}
                messagePrompt={messagePrompt}
                onPromptChange={handlePromptChange}
                isUploading={isUploading}
                onSendMessage={handleSendMessage}
                fileInputRef={fileInputRef}
                onFileChange={handleFileChange}
              />

              <MergeConversationModal
                open={showMergeModal}
                activeChat={activeChat}
                conversations={conversations}
                onMerge={handleMergeConversation}
                onClose={() => setShowMergeModal(false)}
              />

              <EmailSimulationModal
                open={showEmailModal}
                draft={emailDraft}
                setDraft={setEmailDraft}
                onSubmit={handleSimulateEmail}
                onClose={() => setShowEmailModal(false)}
                isSubmitting={isSubmittingEmail}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-gray-500">
              <p>Select a conversation to start chatting.</p>
              {!showConversationRail && (
                <button
                  type="button"
                  onClick={() => setShowConversationRail(true)}
                  className="app-secondary-button"
                >
                  Show conversation list
                </button>
              )}
            </div>
          )}
        </div>

        {showDetailsRail && (
          <div className="flex h-full min-h-0 min-w-0 flex-col border-l app-surface-divider app-main-surface">
            <InboxDetailsRail
              activeChat={activeChat}
              activeCustomer={activeCustomer}
              conversations={conversations}
              agents={agents}
              copilot={copilot}
              isUploading={isUploading}
              isCreatingTicket={isCreatingTicket}
              onSetMessagePrompt={setMessagePrompt}
              onSendSuggestedReply={handleSendMessage}
              onCreateTicket={handleCreateTicket}
            />
          </div>
        )}
      </ResizablePanels>
    </div>
  );
}
