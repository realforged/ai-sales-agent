import { MessageDirection } from "@/types";
import { getStore } from "@/lib/store";
import { generateId } from "@/lib/utils";

export interface MessageResult {
  success: boolean;
  messageId: string;
  timestamp: Date;
  channel: "whatsapp" | "email";
  recipient: string;
  error?: string;
}

export interface MessagingProvider {
  sendMessage(
    to: string,
    message: string,
    channel: "whatsapp" | "email"
  ): Promise<MessageResult>;
}

export class MockMessagingProvider implements MessagingProvider {
  private log: Array<{
    to: string;
    message: string;
    channel: string;
    timestamp: Date;
    success: boolean;
  }> = [];

  async sendMessage(
    to: string,
    message: string,
    channel: "whatsapp" | "email"
  ): Promise<MessageResult> {
    const now = new Date();
    const messageId = generateId("MSG");

    const isValidRecipient = !!(to && to.trim().length > 0);
    const isValidMessage = !!(message && message.trim().length > 0);

    const success = isValidRecipient && isValidMessage;

    this.log.push({
      to,
      message: message.substring(0, 200),
      channel,
      timestamp: now,
      success,
    });

    if (!success) {
      return {
        success: false,
        messageId,
        timestamp: now,
        channel,
        recipient: to,
        error: !isValidRecipient ? "Invalid recipient" : "Empty message",
      };
    }

    return {
      success: true,
      messageId,
      timestamp: now,
      channel,
      recipient: to,
    };
  }

  getLog(): Array<{
    to: string;
    message: string;
    channel: string;
    timestamp: Date;
    success: boolean;
  }> {
    return [...this.log];
  }

  clearLog(): void {
    this.log = [];
  }
}

let instance: MockMessagingProvider | null = null;

export function getMessagingProvider(): MessagingProvider {
  if (!instance) {
    instance = new MockMessagingProvider();
  }
  return instance;
}
