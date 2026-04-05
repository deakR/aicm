import { useMemo } from "react";

export default function useInboxDerivedData({ customers, activeChat, messages }) {
  const activeCustomer = useMemo(
    () => customers.find((customer) => customer.id === activeChat?.customer_id),
    [activeChat?.customer_id, customers],
  );

  const lastOutboundMessage = useMemo(
    () =>
      [...messages]
        .filter(
          (message) =>
            !message.is_internal &&
            message.sender_id !== activeChat?.customer_id,
        )
        .at(-1),
    [messages, activeChat?.customer_id],
  );

  return {
    activeCustomer,
    lastOutboundMessage,
  };
}
