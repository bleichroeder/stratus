import { Node } from "@tiptap/core";

export const MeetingMeta = Node.create({
  name: "meetingMeta",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      eventId: { default: null },
      recurringEventId: { default: null },
      date: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-meeting-meta]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", {
      "data-meeting-meta": "",
      style: "display:none",
      ...HTMLAttributes,
    }];
  },
});
