import { Category, Product, ShopSettings } from '../src/types/index.js';

export const initialCategories: Category[] = [
  {
    id: 'cat-fresh-cuts',
    name: 'Fresh Chicken Cuts',
    slug: 'fresh-chicken-cuts',
    description: 'Daily fresh, antibiotic-residue-free tender chicken cleaned with RO water',
    imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80',
    displayOrder: 1
  },
  {
    id: 'cat-specialty',
    name: 'Biryani & Curry Cuts',
    slug: 'biryani-curry-cuts',
    description: 'Expertly carved bone-in & boneless pieces curated for authentic Dum Biryani and traditional gravies',
    imageUrl: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80',
    displayOrder: 2
  },
  {
    id: 'cat-boneless',
    name: 'Boneless & Fillets',
    slug: 'boneless-fillets',
    description: 'Lean high-protein chicken breast and thigh meat, trimmed of all excess fat',
    imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80',
    displayOrder: 3
  },
  {
    id: 'cat-appetizers',
    name: 'Drumsticks & Wings',
    slug: 'drumsticks-wings',
    description: 'Juicy chicken drumsticks, wings, and lollipops perfect for frying and tandoor',
    imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
    displayOrder: 4
  },
  {
    id: 'cat-country',
    name: 'Country Chicken (Natukodi)',
    slug: 'country-chicken-natukodi',
    description: 'Authentic free-range desi country chicken with rich rustic flavor and firm texture',
    imageUrl: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=600&q=80',
    displayOrder: 5
  },
  {
    id: 'cat-eggs',
    name: 'Farm Fresh Eggs',
    slug: 'farm-fresh-eggs',
    description: 'Nutrient-rich, farm-laid white & country brown eggs delivered safely',
    imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80',
    displayOrder: 6
  }
];

export const initialProducts: Product[] = [
  {
    id: 'prod-curry-cut',
    name: 'Fresh Chicken Curry Cut (Skinless)',
    slug: 'fresh-chicken-curry-cut-skinless',
    categoryId: 'cat-fresh-cuts',
    categoryName: 'Fresh Chicken Cuts',
    description: 'Tender, juicy bone-in pieces crafted from farm-raised young chicken. Includes mix of drumstick, thigh, breast and back pieces ideal for Indian curries and gravies. 100% halal cleaned with RO water.',
    imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80',
    weights: [
      { weight: '250g', price: 65, inStock: true },
      { weight: '500g', price: 125, inStock: true },
      { weight: '1kg', price: 240, inStock: true }
    ],
    cutOptions: ['Standard Curry Cut (12-16 pcs/kg)', 'Small Bites (South Indian Gravy Cut)', 'Skin-On Traditional Cut'],
    isAvailable: true,
    isFeatured: true,
    badge: 'Bestseller',
    netWeightDescription: 'Cleaned net weight. Exact weight as billed.'
  },
  {
    id: 'prod-biryani-cut',
    name: 'Chicken Biryani Cut (Large Juicy Pieces)',
    slug: 'chicken-biryani-cut-large-juicy-pieces',
    categoryId: 'cat-specialty',
    categoryName: 'Biryani & Curry Cuts',
    description: 'Specially handpicked larger succulent cuts with bone that absorb biryani masalas deep into the marrow while retaining moisture during slow Dum cooking.',
    imageUrl: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=800&q=80',
    weights: [
      { weight: '500g', price: 135, inStock: true },
      { weight: '1kg', price: 260, inStock: true }
    ],
    cutOptions: ['Classic Dum Biryani Cut (8-10 pcs/kg)', 'Medium Biryani Cut'],
    isAvailable: true,
    isFeatured: true,
    badge: 'Biryani Special',
    netWeightDescription: 'Premium large pieces with bone.'
  },
  {
    id: 'prod-boneless-breast',
    name: 'Tender Chicken Boneless Breast',
    slug: 'tender-chicken-boneless-breast',
    categoryId: 'cat-boneless',
    categoryName: 'Boneless & Fillets',
    description: 'High-protein, ultra-clean breast fillets trimmed of all excess fat and skin. Perfect for fitness enthusiasts, chicken tikka, stir-fries, and butter chicken.',
    imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=800&q=80',
    weights: [
      { weight: '250g', price: 95, inStock: true },
      { weight: '500g', price: 180, inStock: true },
      { weight: '1kg', price: 350, inStock: true }
    ],
    cutOptions: ['Whole Breast Fillets', 'Bite-Sized Cubes (Tikka Cut)', 'Thin Strips'],
    isAvailable: true,
    isFeatured: true,
    badge: 'High Protein',
    netWeightDescription: '100% boneless, zero wastage.'
  },
  {
    id: 'prod-drumsticks',
    name: 'Juicy Chicken Drumsticks (Legs)',
    slug: 'juicy-chicken-drumsticks-legs',
    categoryId: 'cat-appetizers',
    categoryName: 'Drumsticks & Wings',
    description: 'Skinless tender chicken drumsticks with bone, carved for quick marination and rich roasting, tandoori grills, or rich Chettinad leg roast.',
    imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80',
    weights: [
      { weight: '500g', price: 165, inStock: true },
      { weight: '1kg', price: 320, inStock: true }
    ],
    cutOptions: ['Skinless with Deep Slits (Easy Marinate)', 'Standard Whole Drumsticks'],
    isAvailable: true,
    isFeatured: true,
    badge: 'Kids Favorite',
    netWeightDescription: 'Approx 4-5 pcs per 500g.'
  },
  {
    id: 'prod-lollipops',
    name: 'Chicken Lollipop (Frenched Winglets)',
    slug: 'chicken-lollipop-frenched-winglets',
    categoryId: 'cat-appetizers',
    categoryName: 'Drumsticks & Wings',
    description: 'Neatly frenched chicken wings shaped into lollipop drumettes with clean bone handle, ready for crispy Schezwan or spiced Indo-Chinese coating.',
    imageUrl: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=800&q=80',
    weights: [
      { weight: '250g', price: 95, inStock: true },
      { weight: '500g', price: 185, inStock: true },
      { weight: '1kg', price: 360, inStock: true }
    ],
    cutOptions: ['Frenched Winglets (Ready to Batter)'],
    isAvailable: true,
    isFeatured: false,
    badge: 'Party Starter',
    netWeightDescription: 'Clean trimmed bone tips.'
  },
  {
    id: 'prod-country-chicken',
    name: 'Authentic Country Chicken / Natukodi',
    slug: 'authentic-country-chicken-natukodi',
    categoryId: 'cat-country',
    categoryName: 'Country Chicken (Natukodi)',
    description: 'Free-range country chicken raised in villages on natural grains. Offers intense, deeply savory flavor and firm texture prized for authentic Telugu Natukodi Pulusu.',
    imageUrl: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=800&q=80',
    weights: [
      { weight: '500g', price: 235, inStock: true },
      { weight: '1kg', price: 460, inStock: true }
    ],
    cutOptions: ['Skin-On Lightly Singed (Traditional Char)', 'Skinless Country Cut'],
    isAvailable: true,
    isFeatured: true,
    badge: 'Speciality Item',
    netWeightDescription: 'Free-range desi bird. Takes longer to cook.'
  },
  {
    id: 'prod-whole-chicken',
    name: 'Whole Fresh Chicken (Skinless & Dressed)',
    slug: 'whole-fresh-chicken-skinless-dressed',
    categoryId: 'cat-fresh-cuts',
    categoryName: 'Fresh Chicken Cuts',
    description: 'Full dressed tender young broiler chicken, gutted, neck removed, washed with RO water. Ready for whole roasting or custom butchering at home.',
    imageUrl: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=800&q=80',
    weights: [
      { weight: '1kg', price: 220, inStock: true }
    ],
    cutOptions: ['Whole Dressed Bird', 'Halved (2 halves)', 'Quartered (4 pieces)'],
    isAvailable: true,
    isFeatured: false,
    badge: 'Great Value',
    netWeightDescription: 'Net bird weight 1.0 kg - 1.1 kg.'
  },
  {
    id: 'prod-liver-gizzard',
    name: 'Fresh Chicken Liver & Gizzard Mix',
    slug: 'fresh-chicken-liver-gizzard-mix',
    categoryId: 'cat-fresh-cuts',
    categoryName: 'Fresh Chicken Cuts',
    description: 'Freshly cleaned nutrient-dense iron-rich chicken liver and firm gizzards, thoroughly washed and cleaned. Great for spicy dry roasts.',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    weights: [
      { weight: '250g', price: 60, inStock: true },
      { weight: '500g', price: 110, inStock: true }
    ],
    cutOptions: ['Cleaned Mix (Liver + Gizzard)', 'Liver Only', 'Gizzard Only'],
    isAvailable: true,
    isFeatured: false,
    badge: 'High Iron',
    netWeightDescription: 'Cleaned thoroughly with RO water.'
  },
  {
    id: 'prod-farm-eggs',
    name: 'Farm Fresh White Table Eggs (Pack of 12)',
    slug: 'farm-fresh-white-table-eggs-pack-12',
    categoryId: 'cat-eggs',
    categoryName: 'Farm Fresh Eggs',
    description: 'Clean, unfertilized, graded white eggs from healthy hens fed a balanced grain diet. Packed in sturdy eco-friendly egg crates to prevent breakage during transit.',
    imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=800&q=80',
    weights: [
      { weight: '500g', price: 90, inStock: true }, // Equivalent unit price
      { weight: '1kg', price: 170, inStock: true } // Pack of 24
    ],
    cutOptions: ['Pack of 12 Eggs', 'Pack of 24 Eggs'],
    isAvailable: true,
    isFeatured: false,
    badge: 'Daily Essential',
    netWeightDescription: 'Carefully cushioned packaging.'
  }
];

export const initialShopSettings: ShopSettings = {
  shopName: 'Chandu Chicken Center',
  tagline: '100% Farm Fresh Tender Chicken Delivered to Your Doorstep in 45 Mins',
  shopPhone: '+91 98480 22338',
  shopWhatsApp: '+91 98480 22338',
  address: 'Shop No. 4, Main Road, Market Junction, Near RTC Bus Stand',
  landmark: 'Opposite Rythu Bazar',
  city: 'Hyderabad / Vijayawada',
  isOpen: true,
  openTime: '07:00 AM',
  closeTime: '09:00 PM',
  deliveryFee: 30,
  freeDeliveryThreshold: 499,
  minOrderAmount: 150,
  deliveryTimeEstimateMins: 45,
  announcementBanner: '⚡ Fast delivery in 45 minutes! 100% RO Water Cleaned, Antibiotic-Free Chicken.'
};
