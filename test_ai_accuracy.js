const API_URL = process.env.API_URL || "http://localhost:8900";
const CUSTOMER_EMAIL = process.env.AI_TEST_CUSTOMER_EMAIL || "priya.customer@aicm.local";
const CUSTOMER_PASSWORD = process.env.AI_TEST_CUSTOMER_PASSWORD || "Customer12345!";

const TEST_CASES = [
  {
    name: "Standard shipping timeline",
    question: "How long does standard shipping take?",
    expectedAny: ["3 to 5", "business days", "5 to 7"],
  },
  {
    name: "Expedited shipping availability",
    question: "Do you offer expedited or overnight shipping?",
    expectedAny: ["1 to 2", "overnight", "expedited"],
  },
  {
    name: "Tracking delay guidance",
    question: "Tracking has not updated for one day. What should I do?",
    expectedAny: ["24 hours", "48 hours", "courier", "tracking"],
  },
  {
    name: "Address change policy",
    question: "Can I change my delivery address after placing an order?",
    expectedAny: ["before", "packed", "shipped", "address"],
  },
  {
    name: "Order not arrived",
    question: "My order did not arrive. What should I do next?",
    expectedAny: ["2 to 3", "48 hours", "investigation", "delays"],
  },
  {
    name: "Damaged package handling",
    question: "My package arrived damaged. What information do you need?",
    expectedAny: ["photos", "24 hours", "replacement", "refund", "claim"],
  },
  {
    name: "Return and refund timing",
    question: "How long does refund take after returning an item?",
    expectedAny: ["3 to 5", "business days", "inspected", "warehouse"],
  },
  {
    name: "Cancellation after shipping",
    question: "Can I cancel my order after it has shipped?",
    expectedAny: ["cannot", "packed", "shipped", "no longer"],
  },
];

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  return response;
}

async function loginCustomer() {
  const response = await api("/api/auth/customer/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Customer login failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  if (!data?.token) {
    throw new Error("Customer login succeeded but token was not returned");
  }

  return data.token;
}

async function createConversation(token) {
  const response = await api("/api/protected/customer/chat-session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create conversation (${response.status}): ${body}`);
  }

  const data = await response.json();
  if (!data?.conversation_id) {
    throw new Error("Chat session response did not include conversation_id");
  }

  return data.conversation_id;
}

async function sendCustomerMessage(token, conversationId, content) {
  const response = await api(`/api/protected/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send message (${response.status}): ${body}`);
  }

  return response.json();
}

async function getMessages(token, conversationId) {
  const response = await api(`/api/protected/conversations/${conversationId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch messages (${response.status}): ${body}`);
  }

  return response.json();
}

async function waitForAIReply(token, conversationId, customerMessageId) {
  const maxAttempts = 24;
  const delayMs = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const messages = await getMessages(token, conversationId);
    const aiReply = [...messages]
      .reverse()
      .find(
        (message) =>
          message.is_ai_generated === true &&
          message.sender_role === "admin" &&
          message.id !== customerMessageId,
      );

    if (aiReply?.content?.trim()) {
      return aiReply.content.trim();
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Timed out waiting for AI response");
}

function evaluateReply(reply, expectedAny) {
  const normalized = reply.toLowerCase();
  const matched = expectedAny.filter((needle) =>
    normalized.includes(needle.toLowerCase()),
  );
  return {
    passed: matched.length > 0,
    matched,
  };
}

async function run() {
  console.log(`AI accuracy test started against ${API_URL}`);
  const token = await loginCustomer();

  const results = [];

  for (const testCase of TEST_CASES) {
    const conversationId = await createConversation(token);
    const sent = await sendCustomerMessage(token, conversationId, testCase.question);
    const aiReply = await waitForAIReply(token, conversationId, sent.id);
    const evaluation = evaluateReply(aiReply, testCase.expectedAny);

    results.push({
      name: testCase.name,
      question: testCase.question,
      expectedAny: testCase.expectedAny,
      reply: aiReply,
      passed: evaluation.passed,
      matched: evaluation.matched,
    });

    const status = evaluation.passed ? "PASS" : "FAIL";
    console.log(`\n[${status}] ${testCase.name}`);
    console.log(`Q: ${testCase.question}`);
    console.log(`A: ${aiReply}`);
    console.log(`Matched keywords: ${evaluation.matched.join(", ") || "none"}`);
  }

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  console.log("\n===========================");
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Accuracy: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log("===========================\n");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("AI accuracy test failed:", error.message);
  process.exitCode = 1;
});
