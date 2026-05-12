import { expect, type Locator } from "@playwright/test";

export async function expectReadableCheckoutField(field: Locator) {
  const contrast = await field.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    const text = lightness(styles.color);
    const background = lightness(styles.backgroundColor);
    const contrastRatio = (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);

    return {
      color: styles.color,
      backgroundColor: styles.backgroundColor,
      background,
      contrastRatio,
    };

    function lightness(value: string) {
      const rgb = parseRgb(value) || parseSrgb(value);

      if (rgb) {
        return relativeLuminance(rgb);
      }

      const lab = value.match(/lab\(\s*([0-9.]+)%?/i);

      if (lab) {
        const numeric = Number(lab[1]);
        return numeric > 1 ? numeric / 100 : numeric;
      }

      const oklch = value.match(/oklch\(\s*([0-9.]+)%?/i);

      if (oklch) {
        const numeric = Number(oklch[1]);
        return numeric > 1 ? numeric / 100 : numeric;
      }

      return 0;
    }

    function parseRgb(value: string) {
      const match = value.match(/rgba?\(([^)]+)\)/i);

      if (!match) {
        return null;
      }

      const channels = match[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).map(Number);

      if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) {
        return null;
      }

      return channels.map((channel) => channel / 255);
    }

    function parseSrgb(value: string) {
      const match = value.match(/color\(\s*srgb\s+([^)]+)\)/i);

      if (!match) {
        return null;
      }

      const channels = match[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).map((channel) => (
        channel.endsWith("%") ? Number(channel.slice(0, -1)) / 100 : Number(channel)
      ));

      if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) {
        return null;
      }

      return channels;
    }

    function relativeLuminance([red, green, blue]: number[]) {
      const [r, g, b] = [red, green, blue].map((channel) => (
        channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      ));

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
  });

  expect(contrast.background, `checkout field should use a light background: ${contrast.backgroundColor}`).toBeGreaterThan(0.72);
  expect(contrast.contrastRatio, `checkout field text should contrast with ${contrast.backgroundColor}`).toBeGreaterThan(4.5);
}
