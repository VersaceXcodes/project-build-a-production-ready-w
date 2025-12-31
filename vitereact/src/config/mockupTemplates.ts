// ===========================
// MOCKUP TEMPLATE SYSTEM
// Configuration for realistic product mockups
// ===========================

export interface DesignPlacement {
  sideKey: 'front' | 'back' | string; // which mapped side to show
  x: number;      // position in percentage
  y: number;      // position in percentage
  width: number;  // width in percentage
  height: number; // height in percentage
  rotationDeg?: number;   // perspective/angle approximation
  borderRadius?: number;  // rounded corners in px
  skewX?: number;         // horizontal skew for perspective
  skewY?: number;         // vertical skew for perspective
  opacity?: number;       // design overlay opacity (0-1)
  blendMode?: string;     // CSS blend mode for realistic compositing
}

export interface MockupTemplate {
  id: string;
  label: string;           // e.g. "On desk", "In hand"
  imageUrl: string;        // base scene image (use placeholder URLs)
  maskUrl?: string;        // optional alpha mask for design area
  designPlacement: DesignPlacement;
  aspectRatio?: string;    // e.g. "4/3", "16/9"
}

export interface ProductMockupConfig {
  productSlug: string;
  templates: MockupTemplate[];
}

// ===========================
// MOCKUP TEMPLATES BY PRODUCT TYPE
// ===========================

// Business Cards Mockups
const businessCardsMockups: MockupTemplate[] = [
  {
    id: 'bc-desk-front',
    label: 'On Desk',
    imageUrl: '/mockups/business-card-desk.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 25,
      y: 30,
      width: 50,
      height: 35,
      rotationDeg: -3,
      borderRadius: 4,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'bc-hand-front',
    label: 'In Hand',
    imageUrl: '/mockups/business-card-hand.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 30,
      y: 25,
      width: 45,
      height: 30,
      rotationDeg: 5,
      borderRadius: 4,
      opacity: 0.92,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'bc-stack-front',
    label: 'Card Stack',
    imageUrl: '/mockups/business-card-stack.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 28,
      y: 20,
      width: 48,
      height: 32,
      rotationDeg: 0,
      borderRadius: 4,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
];

// Flyers Mockups
const flyersMockups: MockupTemplate[] = [
  {
    id: 'fl-desk-front',
    label: 'On Desk',
    imageUrl: '/mockups/flyer-desk.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 20,
      y: 15,
      width: 60,
      height: 70,
      rotationDeg: -2,
      borderRadius: 2,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'fl-hand-front',
    label: 'Held in Hand',
    imageUrl: '/mockups/flyer-hand.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 25,
      y: 10,
      width: 55,
      height: 65,
      rotationDeg: 8,
      borderRadius: 0,
      opacity: 0.92,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'fl-display-front',
    label: 'Display Stand',
    imageUrl: '/mockups/flyer-display.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 30,
      y: 12,
      width: 45,
      height: 60,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
];

// Postcards Mockups
const postcardsMockups: MockupTemplate[] = [
  {
    id: 'pc-table-front',
    label: 'On Table',
    imageUrl: '/mockups/postcard-table.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 22,
      y: 25,
      width: 55,
      height: 40,
      rotationDeg: -5,
      borderRadius: 3,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'pc-mail-front',
    label: 'With Mail',
    imageUrl: '/mockups/postcard-mail.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 28,
      y: 20,
      width: 50,
      height: 38,
      rotationDeg: 3,
      borderRadius: 2,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'pc-hand-back',
    label: 'Writing Side',
    imageUrl: '/mockups/postcard-writing.jpg',
    designPlacement: {
      sideKey: 'back',
      x: 25,
      y: 22,
      width: 52,
      height: 38,
      rotationDeg: 0,
      borderRadius: 2,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
];

// Envelopes Mockups
const envelopesMockups: MockupTemplate[] = [
  {
    id: 'env-desk-front',
    label: 'On Wood Surface',
    imageUrl: '/mockups/envelope-wood.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 18,
      y: 25,
      width: 65,
      height: 45,
      rotationDeg: -4,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'env-stack-front',
    label: 'Stacked Envelopes',
    imageUrl: '/mockups/envelope-stack.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 20,
      y: 18,
      width: 60,
      height: 42,
      rotationDeg: 2,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'env-mail-front',
    label: 'Mail Scene',
    imageUrl: '/mockups/envelope-mail.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 22,
      y: 28,
      width: 58,
      height: 40,
      rotationDeg: -6,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
];

// Stickers Mockups
const stickersMockups: MockupTemplate[] = [
  {
    id: 'st-laptop-front',
    label: 'On Laptop',
    imageUrl: '/mockups/sticker-laptop.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 35,
      y: 30,
      width: 30,
      height: 30,
      rotationDeg: 0,
      borderRadius: 8,
      opacity: 0.95,
    },
    aspectRatio: '16/10',
  },
  {
    id: 'st-bottle-front',
    label: 'On Water Bottle',
    imageUrl: '/mockups/sticker-bottle.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 38,
      y: 35,
      width: 25,
      height: 25,
      rotationDeg: 5,
      borderRadius: 50,
      opacity: 0.92,
    },
    aspectRatio: '3/4',
  },
  {
    id: 'st-sheet-front',
    label: 'Sticker Sheet',
    imageUrl: '/mockups/sticker-sheet.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 30,
      y: 25,
      width: 40,
      height: 50,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
];

// Letterheads Mockups
const letterheadsMockups: MockupTemplate[] = [
  {
    id: 'lh-desk-front',
    label: 'On Desk',
    imageUrl: '/mockups/letterhead-desk.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 20,
      y: 10,
      width: 60,
      height: 75,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'lh-folder-front',
    label: 'With Folder',
    imageUrl: '/mockups/letterhead-folder.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 25,
      y: 12,
      width: 55,
      height: 70,
      rotationDeg: -3,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'lh-brand-front',
    label: 'Brand Scene',
    imageUrl: '/mockups/letterhead-brand.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 22,
      y: 15,
      width: 55,
      height: 68,
      rotationDeg: 2,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
];

// ===========================
// PRODUCT MOCKUP CONFIGURATIONS
// Maps product slugs to their mockup templates
// ===========================

export const productMockupConfigs: ProductMockupConfig[] = [
  {
    productSlug: 'business-cards',
    templates: businessCardsMockups,
  },
  {
    productSlug: 'flyers',
    templates: flyersMockups,
  },
  {
    productSlug: 'postcards',
    templates: postcardsMockups,
  },
  {
    productSlug: 'envelopes',
    templates: envelopesMockups,
  },
  {
    productSlug: 'stickers',
    templates: stickersMockups,
  },
  {
    productSlug: 'letterheads',
    templates: letterheadsMockups,
  },
];

// ===========================
// HELPER FUNCTIONS
// ===========================

/**
 * Get mockup templates for a specific product by slug
 */
export function getMockupTemplatesForProduct(productSlug: string): MockupTemplate[] {
  const config = productMockupConfigs.find(
    (c) => c.productSlug.toLowerCase() === productSlug.toLowerCase()
  );
  return config?.templates || [];
}

/**
 * Get a specific template by ID
 */
export function getMockupTemplateById(templateId: string): MockupTemplate | undefined {
  for (const config of productMockupConfigs) {
    const template = config.templates.find((t) => t.id === templateId);
    if (template) return template;
  }
  return undefined;
}

/**
 * Generate a placeholder mockup image URL based on product type
 * This can be replaced with actual mockup images later
 */
export function getPlaceholderMockupImage(productSlug: string, scene: string): string {
  // Return a gradient placeholder that can be used before real images are uploaded
  // In production, these would be real mockup scene images
  const colors: Record<string, string> = {
    'business-cards': '#f5f5dc,#deb887',
    'flyers': '#e6e6fa,#d8bfd8',
    'postcards': '#ffe4e1,#ffc0cb',
    'envelopes': '#f0fff0,#98fb98',
    'stickers': '#e0ffff,#afeeee',
    'letterheads': '#fff8dc,#faebd7',
  };
  const color = colors[productSlug] || '#f0f0f0,#e0e0e0';
  return `https://via.placeholder.com/800x600/${color.split(',')[0].slice(1)}/${color.split(',')[1].slice(1)}?text=${encodeURIComponent(scene)}`;
}
