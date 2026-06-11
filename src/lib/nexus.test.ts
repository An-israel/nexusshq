import { describe, expect, it } from "vitest";
import { deptLabel, escapeHtml, initialsOf } from "./nexus";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("escapes ampersands and single quotes", () => {
    expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#39;s");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Finish the report")).toBe("Finish the report");
  });
});

describe("deptLabel", () => {
  it("title-cases department slugs", () => {
    expect(deptLabel("customer_success")).toBe("Customer Success");
    expect(deptLabel("video_editing")).toBe("Video Editing");
  });

  it("returns an em dash for null/undefined", () => {
    expect(deptLabel(null)).toBe("—");
    expect(deptLabel(undefined)).toBe("—");
  });
});

describe("initialsOf", () => {
  it("returns first+last initials for full names", () => {
    expect(initialsOf("Ada Lovelace")).toBe("AL");
  });

  it("returns first two letters for single-word names", () => {
    expect(initialsOf("Cher")).toBe("CH");
  });

  it("returns ? for empty input", () => {
    expect(initialsOf(null)).toBe("?");
    expect(initialsOf("")).toBe("?");
  });
});
