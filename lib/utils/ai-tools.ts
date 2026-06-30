import type Anthropic from "@anthropic-ai/sdk";

const BLOCK_TYPES = [
  "hero", "text", "image", "feature_grid", "testimonial", "pricing_card",
  "image_text", "guarantee", "cta_banner", "video_embed", "spacer", "divider",
  "application_form", "simple_form", "music_embed", "album_showcase", "discography",
];

export const BLOCK_TOOLS: Anthropic.Tool[] = [
  {
    name: "add_block",
    description: "Add a new content block to the page. Blocks are the building blocks of the page — each represents a section like a hero banner, text paragraph, image, feature grid, etc. If after_block_id is omitted the block is appended at the end.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: BLOCK_TYPES, description: "The block type to create." },
        after_block_id: { type: "string", description: "Insert the new block immediately after this block's ID. Omit to append at the end." },
        data_overrides: { type: "object", description: "Optional initial field values for the block (e.g. {headline: 'Welcome'} for a hero block). Use BLOCK_LABELS to know available fields." },
      },
      required: ["type"],
    },
  },
  {
    name: "update_block_data",
    description: "Update one or more fields of an existing block. Provide only the fields you want to change — unspecified fields stay as-is.",
    input_schema: {
      type: "object",
      properties: {
        block_id: { type: "string", description: "The block's id." },
        data: { type: "object", description: "Partial block data to merge in. E.g. {headline: 'New Title'} or {height: 'full', textAlign: 'center'}." },
      },
      required: ["block_id", "data"],
    },
  },
  {
    name: "move_block",
    description: "Move a block to a different position in the page. target_index is 0-based.",
    input_schema: {
      type: "object",
      properties: {
        block_id: { type: "string" },
        target_index: { type: "number", description: "The new 0-based position for this block." },
      },
      required: ["block_id", "target_index"],
    },
  },
  {
    name: "remove_block",
    description: "Delete a block from the page permanently.",
    input_schema: {
      type: "object",
      properties: { block_id: { type: "string" } },
      required: ["block_id"],
    },
  },
  {
    name: "duplicate_block",
    description: "Create a copy of a block immediately below it.",
    input_schema: {
      type: "object",
      properties: { block_id: { type: "string" } },
      required: ["block_id"],
    },
  },
];

export const HTML_TOOLS: Anthropic.Tool[] = [
  {
    name: "set_text_content",
    description: "Change the text content of an HTML element matched by a CSS selector.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the target element (e.g. 'h1', '#hero-title', '.nav-brand')." },
        new_text: { type: "string", description: "The new text content." },
      },
      required: ["selector", "new_text"],
    },
  },
  {
    name: "set_attribute",
    description: "Set an attribute on an HTML element (e.g. href, src, alt, class, data-*).",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        attribute: { type: "string", description: "Attribute name (e.g. 'href', 'src', 'alt', 'class')." },
        value: { type: "string", description: "New attribute value." },
      },
      required: ["selector", "attribute", "value"],
    },
  },
  {
    name: "set_inline_style",
    description: "Apply CSS style properties to an element via its style attribute. Existing styles are preserved unless overwritten.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        style_properties: {
          type: "object",
          description: "CSS property names and values (e.g. {\"background-color\": \"#1a1a2e\", \"color\": \"white\"}).",
          additionalProperties: { type: "string" },
        },
      },
      required: ["selector", "style_properties"],
    },
  },
  {
    name: "insert_html",
    description: "Insert an HTML snippet at a position relative to an element, or append/prepend to the page body. Script tags are automatically stripped.",
    input_schema: {
      type: "object",
      properties: {
        html: { type: "string", description: "The HTML snippet to insert." },
        position: {
          type: "string",
          enum: ["after_selector", "before_selector", "append_to_body", "prepend_to_body"],
          description: "Where to insert: after/before a specific element, or append/prepend to body.",
        },
        selector: { type: "string", description: "Required when position is after_selector or before_selector." },
      },
      required: ["html", "position"],
    },
  },
  {
    name: "replace_element",
    description: "Replace a specific element (matched by selector) with new HTML — use this to redesign a section. Script tags are automatically stripped from the new HTML.",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the element to replace." },
        new_html: { type: "string", description: "The replacement HTML (outerHTML level — includes the wrapper element)." },
      },
      required: ["selector", "new_html"],
    },
  },
  {
    name: "remove_element",
    description: "Remove an element from the page.",
    input_schema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"],
    },
  },
  {
    name: "add_link",
    description: "Find the first occurrence of a text string on the page and wrap it in an <a> tag with the given href.",
    input_schema: {
      type: "object",
      properties: {
        text_to_link: { type: "string", description: "The exact text to find and wrap in a link." },
        href: { type: "string", description: "The URL for the link (e.g. 'https://example.com', '#contact', 'mailto:hi@example.com')." },
      },
      required: ["text_to_link", "href"],
    },
  },
  {
    name: "get_element_html",
    description: "Read-only. Returns the outer HTML of an element. Use this when you need to inspect a specific section before deciding how to modify or replace it.",
    input_schema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"],
    },
  },
];

/** Human-readable label for a tool call, shown as activity indicator in the chat panel. */
export function toolCallLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "add_block": return `Adding ${String(input.type ?? "block")} block`;
    case "update_block_data": return `Updating block`;
    case "move_block": return `Moving block`;
    case "remove_block": return `Removing block`;
    case "duplicate_block": return `Duplicating block`;
    case "set_text_content": return `Editing text`;
    case "set_attribute": return `Setting ${String(input.attribute ?? "attribute")}`;
    case "set_inline_style": return `Styling element`;
    case "insert_html": return `Inserting section`;
    case "replace_element": return `Redesigning section`;
    case "remove_element": return `Removing element`;
    case "add_link": return `Adding link`;
    case "get_element_html": return `Reading page structure`;
    default: return name;
  }
}
