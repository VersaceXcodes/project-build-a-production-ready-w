// ===========================
// MOCKUP TEMPLATE SYSTEM
// Configuration for realistic product mockups
// Enhanced for Canva-style preview experience
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
// Enhanced with multiple lifestyle views
// ===========================

// Business Cards Mockups - Enhanced with 5 views including back
const businessCardsMockups: MockupTemplate[] = [
  {
    id: 'bc-flat-single',
    label: 'Single Flat Card',
    imageUrl: '/mockups/business-card-flat.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 15,
      y: 15,
      width: 70,
      height: 70,
      rotationDeg: 0,
      borderRadius: 4,
      opacity: 1,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'bc-stack-front',
    label: 'Card Stack',
    imageUrl: '/mockups/business-card-stack.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 20,
      y: 18,
      width: 60,
      height: 55,
      rotationDeg: -3,
      borderRadius: 4,
      opacity: 0.98,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'bc-perspective-front',
    label: 'Perspective View',
    imageUrl: '/mockups/business-card-perspective.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 22,
      y: 20,
      width: 56,
      height: 52,
      rotationDeg: 0,
      skewX: -8,
      skewY: 4,
      borderRadius: 4,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'bc-floating',
    label: 'Floating',
    imageUrl: '/mockups/business-card-floating.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 18,
      y: 22,
      width: 64,
      height: 56,
      rotationDeg: 5,
      borderRadius: 4,
      opacity: 0.98,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'bc-back-view',
    label: 'Back Side',
    imageUrl: '/mockups/business-card-back.jpg',
    designPlacement: {
      sideKey: 'back',
      x: 15,
      y: 15,
      width: 70,
      height: 70,
      rotationDeg: 0,
      borderRadius: 4,
      opacity: 1,
    },
    aspectRatio: '4/3',
  },
];

// Flyers Mockups - Enhanced with lifestyle views
const flyersMockups: MockupTemplate[] = [
  {
    id: 'fl-flat-front',
    label: 'Flat View',
    imageUrl: '/mockups/flyer-flat.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 12,
      y: 8,
      width: 76,
      height: 84,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 1,
    },
    aspectRatio: '3/4',
  },
  {
    id: 'fl-desk-front',
    label: 'On Desk',
    imageUrl: '/mockups/flyer-desk.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 18,
      y: 12,
      width: 64,
      height: 76,
      rotationDeg: -2,
      borderRadius: 0,
      opacity: 0.98,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'fl-stack',
    label: 'Stacked',
    imageUrl: '/mockups/flyer-stack.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 20,
      y: 15,
      width: 60,
      height: 70,
      rotationDeg: -4,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'fl-display-front',
    label: 'Display Stand',
    imageUrl: '/mockups/flyer-display.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 25,
      y: 10,
      width: 50,
      height: 70,
      rotationDeg: 0,
      skewX: -3,
      skewY: 2,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'fl-back-view',
    label: 'Back Side',
    imageUrl: '/mockups/flyer-back.jpg',
    designPlacement: {
      sideKey: 'back',
      x: 12,
      y: 8,
      width: 76,
      height: 84,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 1,
    },
    aspectRatio: '3/4',
  },
];

// Postcards Mockups - Enhanced
const postcardsMockups: MockupTemplate[] = [
  {
    id: 'pc-flat-front',
    label: 'Flat View',
    imageUrl: '/mockups/postcard-flat.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 12,
      y: 12,
      width: 76,
      height: 76,
      rotationDeg: 0,
      borderRadius: 2,
      opacity: 1,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'pc-table-front',
    label: 'On Table',
    imageUrl: '/mockups/postcard-table.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 18,
      y: 20,
      width: 64,
      height: 55,
      rotationDeg: -5,
      borderRadius: 3,
      opacity: 0.98,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'pc-stack',
    label: 'Stacked',
    imageUrl: '/mockups/postcard-stack.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 20,
      y: 18,
      width: 60,
      height: 58,
      rotationDeg: 3,
      borderRadius: 2,
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
      x: 22,
      y: 15,
      width: 56,
      height: 52,
      rotationDeg: 3,
      borderRadius: 2,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'pc-back-view',
    label: 'Writing Side',
    imageUrl: '/mockups/postcard-writing.jpg',
    designPlacement: {
      sideKey: 'back',
      x: 12,
      y: 12,
      width: 76,
      height: 76,
      rotationDeg: 0,
      borderRadius: 2,
      opacity: 1,
    },
    aspectRatio: '4/3',
  },
];

// Envelopes Mockups - Enhanced
const envelopesMockups: MockupTemplate[] = [
  {
    id: 'env-flat-front',
    label: 'Flat View',
    imageUrl: '/mockups/envelope-flat.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 10,
      y: 18,
      width: 80,
      height: 64,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 1,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'env-desk-front',
    label: 'On Wood Surface',
    imageUrl: '/mockups/envelope-wood.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 15,
      y: 22,
      width: 70,
      height: 55,
      rotationDeg: -4,
      borderRadius: 0,
      opacity: 0.98,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'env-stack-front',
    label: 'Stacked',
    imageUrl: '/mockups/envelope-stack.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 18,
      y: 15,
      width: 65,
      height: 55,
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
      x: 20,
      y: 25,
      width: 62,
      height: 50,
      rotationDeg: -6,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'env-back-view',
    label: 'Back / Flap',
    imageUrl: '/mockups/envelope-back.jpg',
    designPlacement: {
      sideKey: 'back',
      x: 10,
      y: 18,
      width: 80,
      height: 64,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 1,
    },
    aspectRatio: '4/3',
  },
];

// Stickers Mockups - Enhanced with lifestyle scenes
const stickersMockups: MockupTemplate[] = [
  {
    id: 'st-flat-front',
    label: 'Single Sticker',
    imageUrl: '/mockups/sticker-flat.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 25,
      y: 20,
      width: 50,
      height: 60,
      rotationDeg: 0,
      borderRadius: 8,
      opacity: 1,
    },
    aspectRatio: '1/1',
  },
  {
    id: 'st-laptop-front',
    label: 'On Laptop',
    imageUrl: '/mockups/sticker-laptop.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 32,
      y: 28,
      width: 36,
      height: 44,
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
      x: 35,
      y: 32,
      width: 30,
      height: 36,
      rotationDeg: 5,
      skewX: 3,
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
      x: 22,
      y: 18,
      width: 56,
      height: 64,
      rotationDeg: -2,
      borderRadius: 4,
      opacity: 0.98,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'st-scattered',
    label: 'Scattered View',
    imageUrl: '/mockups/sticker-scattered.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 28,
      y: 25,
      width: 44,
      height: 50,
      rotationDeg: 15,
      borderRadius: 8,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
];

// Letterheads Mockups - Enhanced
const letterheadsMockups: MockupTemplate[] = [
  {
    id: 'lh-flat-front',
    label: 'Flat View',
    imageUrl: '/mockups/letterhead-flat.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 12,
      y: 6,
      width: 76,
      height: 88,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 1,
    },
    aspectRatio: '3/4',
  },
  {
    id: 'lh-desk-front',
    label: 'On Desk',
    imageUrl: '/mockups/letterhead-desk.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 18,
      y: 8,
      width: 65,
      height: 82,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 0.98,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'lh-folder-front',
    label: 'With Folder',
    imageUrl: '/mockups/letterhead-folder.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 22,
      y: 10,
      width: 58,
      height: 75,
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
      x: 20,
      y: 12,
      width: 60,
      height: 72,
      rotationDeg: 2,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'lh-perspective',
    label: 'Perspective',
    imageUrl: '/mockups/letterhead-perspective.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 25,
      y: 15,
      width: 52,
      height: 68,
      rotationDeg: 0,
      skewX: -5,
      skewY: 3,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
];

// Brochures Mockups - Enhanced with folded/open views
const brochuresMockups: MockupTemplate[] = [
  {
    id: 'br-cover-front',
    label: 'Cover',
    imageUrl: '/mockups/brochure-cover.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 18,
      y: 10,
      width: 64,
      height: 80,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 1,
    },
    aspectRatio: '3/4',
  },
  {
    id: 'br-open-front',
    label: 'Open View',
    imageUrl: '/mockups/brochure-open.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 10,
      y: 15,
      width: 80,
      height: 60,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 0.98,
    },
    aspectRatio: '16/9',
  },
  {
    id: 'br-folded-front',
    label: 'Tri-Fold',
    imageUrl: '/mockups/brochure-folded.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 22,
      y: 18,
      width: 56,
      height: 64,
      rotationDeg: -5,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'br-stack-front',
    label: 'Stack',
    imageUrl: '/mockups/brochure-stack.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 18,
      y: 22,
      width: 60,
      height: 56,
      rotationDeg: 3,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'br-back-view',
    label: 'Back Cover',
    imageUrl: '/mockups/brochure-back.jpg',
    designPlacement: {
      sideKey: 'back',
      x: 18,
      y: 10,
      width: 64,
      height: 80,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 1,
    },
    aspectRatio: '3/4',
  },
];

// Booklets Mockups
const bookletsMockups: MockupTemplate[] = [
  {
    id: 'bk-cover-front',
    label: 'Cover',
    imageUrl: '/mockups/booklet-cover.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 15,
      y: 8,
      width: 70,
      height: 84,
      rotationDeg: 0,
      borderRadius: 2,
      opacity: 1,
    },
    aspectRatio: '3/4',
  },
  {
    id: 'bk-open',
    label: 'Open Spread',
    imageUrl: '/mockups/booklet-open.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 8,
      y: 12,
      width: 84,
      height: 65,
      rotationDeg: 0,
      borderRadius: 2,
      opacity: 0.98,
    },
    aspectRatio: '16/9',
  },
  {
    id: 'bk-standing',
    label: 'Standing',
    imageUrl: '/mockups/booklet-standing.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 28,
      y: 8,
      width: 44,
      height: 80,
      rotationDeg: 0,
      skewX: -3,
      skewY: 2,
      borderRadius: 2,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'bk-stack',
    label: 'Stacked',
    imageUrl: '/mockups/booklet-stack.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 20,
      y: 15,
      width: 60,
      height: 65,
      rotationDeg: -4,
      borderRadius: 2,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'bk-back',
    label: 'Back Cover',
    imageUrl: '/mockups/booklet-back.jpg',
    designPlacement: {
      sideKey: 'back',
      x: 15,
      y: 8,
      width: 70,
      height: 84,
      rotationDeg: 0,
      borderRadius: 2,
      opacity: 1,
    },
    aspectRatio: '3/4',
  },
];

// Posters Mockups
const postersMockups: MockupTemplate[] = [
  {
    id: 'ps-flat-front',
    label: 'Flat View',
    imageUrl: '/mockups/poster-flat.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 8,
      y: 5,
      width: 84,
      height: 90,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 1,
    },
    aspectRatio: '2/3',
  },
  {
    id: 'ps-frame',
    label: 'Framed',
    imageUrl: '/mockups/poster-frame.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 15,
      y: 10,
      width: 70,
      height: 80,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 0.98,
    },
    aspectRatio: '3/4',
  },
  {
    id: 'ps-wall',
    label: 'On Wall',
    imageUrl: '/mockups/poster-wall.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 25,
      y: 15,
      width: 50,
      height: 65,
      rotationDeg: 0,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'ps-rolled',
    label: 'Rolled',
    imageUrl: '/mockups/poster-rolled.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 18,
      y: 12,
      width: 64,
      height: 75,
      rotationDeg: 3,
      borderRadius: 0,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
];

// Menus Mockups
const menusMockups: MockupTemplate[] = [
  {
    id: 'mn-flat-front',
    label: 'Flat View',
    imageUrl: '/mockups/menu-flat.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 10,
      y: 5,
      width: 80,
      height: 90,
      rotationDeg: 0,
      borderRadius: 2,
      opacity: 1,
    },
    aspectRatio: '3/4',
  },
  {
    id: 'mn-table',
    label: 'On Table',
    imageUrl: '/mockups/menu-table.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 18,
      y: 12,
      width: 65,
      height: 76,
      rotationDeg: -3,
      borderRadius: 2,
      opacity: 0.98,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'mn-holder',
    label: 'In Holder',
    imageUrl: '/mockups/menu-holder.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 25,
      y: 8,
      width: 50,
      height: 80,
      rotationDeg: 0,
      skewX: -2,
      skewY: 1,
      borderRadius: 2,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'mn-stack',
    label: 'Stacked',
    imageUrl: '/mockups/menu-stack.jpg',
    designPlacement: {
      sideKey: 'front',
      x: 20,
      y: 15,
      width: 60,
      height: 68,
      rotationDeg: 4,
      borderRadius: 2,
      opacity: 0.95,
    },
    aspectRatio: '4/3',
  },
  {
    id: 'mn-back',
    label: 'Back Side',
    imageUrl: '/mockups/menu-back.jpg',
    designPlacement: {
      sideKey: 'back',
      x: 10,
      y: 5,
      width: 80,
      height: 90,
      rotationDeg: 0,
      borderRadius: 2,
      opacity: 1,
    },
    aspectRatio: '3/4',
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
  {
    productSlug: 'brochures',
    templates: brochuresMockups,
  },
  {
    productSlug: 'booklets',
    templates: bookletsMockups,
  },
  {
    productSlug: 'posters',
    templates: postersMockups,
  },
  {
    productSlug: 'menus',
    templates: menusMockups,
  },
];

// ===========================
// HELPER FUNCTIONS
// ===========================

/**
 * Get mockup templates for a specific product by slug
 * Supports partial matching (e.g., "business-card" matches "business-cards")
 */
export function getMockupTemplatesForProduct(productSlug: string): MockupTemplate[] {
  const normalizedSlug = productSlug.toLowerCase().replace(/\s+/g, '-');
  
  // First try exact match
  let config = productMockupConfigs.find(
    (c) => c.productSlug.toLowerCase() === normalizedSlug
  );
  
  // If no exact match, try partial match
  if (!config) {
    config = productMockupConfigs.find(
      (c) => c.productSlug.toLowerCase().includes(normalizedSlug) ||
             normalizedSlug.includes(c.productSlug.toLowerCase())
    );
  }
  
  // Try singular/plural variations
  if (!config) {
    const singularSlug = normalizedSlug.endsWith('s') ? normalizedSlug.slice(0, -1) : normalizedSlug;
    const pluralSlug = normalizedSlug.endsWith('s') ? normalizedSlug : normalizedSlug + 's';
    
    config = productMockupConfigs.find(
      (c) => c.productSlug.toLowerCase() === singularSlug ||
             c.productSlug.toLowerCase() === pluralSlug
    );
  }
  
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
 * Get templates that show a specific side (front or back)
 */
export function getTemplatesForSide(productSlug: string, side: 'front' | 'back'): MockupTemplate[] {
  const allTemplates = getMockupTemplatesForProduct(productSlug);
  return allTemplates.filter(t => t.designPlacement.sideKey === side);
}

/**
 * Get the default template for a product (usually the first front-facing template)
 */
export function getDefaultTemplate(productSlug: string): MockupTemplate | undefined {
  const templates = getMockupTemplatesForProduct(productSlug);
  return templates.find(t => t.designPlacement.sideKey === 'front') || templates[0];
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
    'brochures': '#f0f8ff,#e6e6fa',
    'booklets': '#faf0e6,#ffe4c4',
    'posters': '#f5f5f5,#e8e8e8',
    'menus': '#fffaf0,#ffefd5',
  };
  const color = colors[productSlug] || '#f0f0f0,#e0e0e0';
  return `https://via.placeholder.com/800x600/${color.split(',')[0].slice(1)}/${color.split(',')[1].slice(1)}?text=${encodeURIComponent(scene)}`;
}

/**
 * Check if a product requires double-sided mockups
 */
export function productHasBackMockup(productSlug: string): boolean {
  const templates = getMockupTemplatesForProduct(productSlug);
  return templates.some(t => t.designPlacement.sideKey === 'back');
}
