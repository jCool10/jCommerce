# Design Guidelines: Storefront & Admin

**Purpose:** Establish visual + interaction design standards across the two frontends. Storefront and Admin have intentionally different design languages (Swiss Modernism vs. shadcn/ui) to signal their distinct purposes.

---

## Design Philosophy

| Aspect | Storefront (Public) | Admin (Internal) |
|--------|-------------------|------------------|
| **Purpose** | Customer-facing e-commerce | Internal staff tools |
| **Audience** | General users, diverse tech comfort | Tech-savvy administrators |
| **Design Language** | Swiss Modernism 2.0 | shadcn/ui + Radix (industry standard) |
| **Color Palette** | Monochrome Zinc + accent | HSL semantic colors + status indicators |
| **Typography** | Display (Rubik) + body (Nunito Sans) | System sans + mono (developer-friendly) |
| **Complexity** | Minimal, focused, hero-driven | Comprehensive, data-dense |
| **Interactions** | Smooth, delightful, accessible | Direct, efficient, keyboard-friendly |

---

## Storefront: Swiss Modernism 2.0

### Philosophy

**Swiss Modernism** (1950s–1970s grid-based, functional design) adapted for modern e-commerce:
- Emphasis on whitespace and typography
- Minimal decoration; every element serves purpose
- Monochrome with single warm accent for CTAs (contrast, intention)
- Sharp corners (0px default border-radius)
- Subtle animations (fade, slide, no bounce)
- Respects user motion preferences (@media prefers-reduced-motion)

### Visual Identity

#### Color Palette

```css
/* Semantic colors (CSS variables) */
:root {
  /* Grayscale: Zinc palette Tailwind 50–950 */
  --bg: rgb(250, 250, 250);              /* Zinc 50: page background */
  --bg-elevated: rgb(255, 255, 255);     /* White: cards, elevated surfaces */
  --fg: rgb(39, 39, 42);                 /* Zinc 900: primary text */
  --fg-muted: rgb(113, 113, 122);        /* Zinc 500: secondary text, labels */
  --border: rgb(228, 228, 231);          /* Zinc 200: dividers, borders */
  --border-subtle: rgb(244, 244, 245);   /* Zinc 100: very subtle borders */
  --ring: rgb(24, 24, 27);               /* Zinc 950: focus rings, strong emphasis */
  
  /* Accent: Single warm color for CTAs only */
  --accent: rgb(255, 77, 45);            /* #FF4D2D: "Call To Action" red-orange */
  
  /* Semantic statuses (minimal, muted) */
  --success: rgb(34, 197, 94);           /* Green (success, available) */
  --warning: rgb(234, 179, 8);           /* Amber (caution, limited stock) */
  --error: rgb(239, 68, 68);             /* Red (error, out of stock) */
  --info: rgb(59, 130, 246);             /* Blue (info, new badge) */
}

/* Dark mode (respects system preference) */
@media (prefers-color-scheme: dark) {
  :root {
    --bg: rgb(24, 24, 27);               /* Zinc 950 */
    --bg-elevated: rgb(39, 39, 42);      /* Zinc 900 */
    --fg: rgb(250, 250, 250);            /* Zinc 50 */
    --fg-muted: rgb(161, 161, 170);      /* Zinc 400 */
    --border: rgb(63, 63, 70);           /* Zinc 800 */
    --ring: rgb(250, 250, 250);          /* Zinc 50 */
    /* Accent + statuses remain unchanged for accessibility */
  }
}
```

#### Typography

| Use | Font | Size | Weight | Line-Height |
|-----|------|------|--------|-------------|
| **Display** (H1, hero) | Rubik | 48px | 700 (bold) | 1.2 |
| **Heading** (H2, section) | Rubik | 32px | 600 (semibold) | 1.25 |
| **Subheading** (H3, subsection) | Rubik | 24px | 600 (semibold) | 1.3 |
| **Body** (P, buttons, labels) | Nunito Sans | 16px | 400 (regular) | 1.5 |
| **Small** (captions, prices, metadata) | Nunito Sans | 14px | 400 (regular) | 1.43 |
| **XSmall** (badges, tags) | Nunito Sans | 12px | 500 (medium) | 1.33 |

**Font Imports:**
```css
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@600;700&family=Nunito+Sans:wght@400;500;600;700&display=swap');
```

#### Border Radius & Shadows

```css
/* Geometric: Sharp corners (zero radius default) */
:root {
  --radius-none: 0px;     /* Default for most elements */
  --radius-sm: 2px;       /* Subtle rounding (form inputs, checkboxes) */
  --radius-md: 4px;       /* Small rounding (cards, buttons) */
  --radius-lg: 6px;       /* Larger rounding (modals, drawers) */
}

/* Shadows: Subtle, functional (not decorative) */
--shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
--shadow-elevated: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
```

### Components & Patterns

#### Buttons

```tsx
// Primary CTA (accent color, no background)
<button className="px-6 py-2 font-medium text-accent border border-accent hover:bg-accent hover:text-white transition-colors">
  Add to Cart
</button>

// Secondary (outline)
<button className="px-6 py-2 font-medium text-fg border border-border hover:bg-bg-elevated transition-colors">
  Continue Shopping
</button>

// Tertiary (text-only, minimal)
<button className="px-4 py-2 text-fg-muted hover:text-fg underline transition-colors">
  Learn More
</button>

// Disabled
<button disabled className="opacity-50 cursor-not-allowed">
  Out of Stock
</button>
```

**Rules:**
- Primary buttons use `#FF4D2D` accent
- No rounded corners (radius-none or radius-sm max)
- Hover: background fill + white text (CTA), or slight bg shift (secondary)
- Focus: 2px solid ring in `--ring` color

#### Cards & Containers

```tsx
// Product card
<div className="border border-border rounded-md p-4 hover:border-fg transition-colors">
  <img src={product.image} alt={product.name} className="w-full aspect-square object-cover" />
  <h3 className="mt-3 font-medium text-fg">{product.name}</h3>
  <p className="text-sm text-fg-muted">${product.price / 100}</p>
</div>

// Elevated card (order confirmation, summary)
<div className="bg-bg-elevated border border-border rounded-md p-6 shadow-sm">
  <h2 className="font-bold text-lg text-fg">Order Confirmed</h2>
  {/* content */}
</div>
```

**Rules:**
- Default: border only (no shadow)
- Elevated: small shadow + white/elevated background
- Padding: 4px (xs), 8px (sm), 16px (md), 24px (lg)
- Rounded: 0–6px max (prefer 0px or 2px)

#### Typography Hierarchy

```tsx
// Hero section
<div className="py-12 px-6">
  <h1 className="text-4xl font-bold text-fg mb-4">Summer Collection</h1>
  <p className="text-lg text-fg-muted mb-6">Timeless pieces for every season</p>
  <button className="px-6 py-2 text-accent border border-accent hover:bg-accent hover:text-white">
    Shop Now
  </button>
</div>

// Product listing
<div className="grid grid-cols-4 gap-4">
  {products.map(product => (
    <div key={product.id}>
      <img src={product.image} alt={product.name} />
      <h3 className="mt-2 font-medium text-fg">{product.name}</h3>
      <p className="text-sm text-fg-muted">${product.price / 100}</p>
    </div>
  ))}
</div>

// Form label
<label className="block text-sm font-medium text-fg mb-2">
  Email Address
</label>
<input type="email" className="w-full px-3 py-2 border border-border rounded-sm text-fg" />
```

#### Animations

```css
/* Smooth, purposeful animations (300–400ms) */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-in-right {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes shimmer {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Apply with Tailwind */
.animate-fade-in-up {
  animation: fade-in-up 0.4s ease-out cubic-bezier(0.22, 1, 0.36, 1);
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}

/* Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### Responsive Layout

```tsx
// Mobile-first Tailwind breakpoints
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Single column on mobile, 2 on tablet, 4 on desktop */}
</div>

// Hero image + text (stacked on mobile)
<section className="flex flex-col lg:flex-row gap-8 items-center">
  <img src={hero} className="w-full lg:w-1/2 aspect-square object-cover" />
  <div className="lg:w-1/2">
    <h1 className="text-3xl lg:text-4xl font-bold mb-4">Heading</h1>
    {/* content */}
  </div>
</section>
```

### Storefront Pages

| Page | Path | Purpose | Key Patterns |
|------|------|---------|--------------|
| **Homepage** | `/` | Hero, featured products, CTAs | Large typography, whitespace, accent buttons |
| **Product Listing** | `/products` | Browse, filter, search | Grid 2–4 cols, facets sidebar, pagination |
| **Product Detail** | `/products/:id` | Image carousel, add to cart, reviews | Large image, specs table, related products |
| **Search Results** | `/search` | Full-text + facets | Same as listing; highlight matched term |
| **Shopping Cart** | `/cart` | Review items, update qty, checkout | Card-based layout, summary sidebar |
| **Checkout** | `/checkout` (protected) | Stripe Elements, shipping, review | Step indicator, form validation feedback |
| **Order Status** | `/orders/:id` (protected) | View order, tracking | Timeline, status indicator, action buttons |
| **User Account** | `/account` (protected) | Profile, orders history, preferences | Tabs or sidebar navigation, settings form |
| **Login / Register** | `/login`, `/register` | Authentication | Centered form, minimal layout |

---

## Admin: shadcn/ui + Radix Standard

### Philosophy

**shadcn/ui** is the modern standard for internal tools and dashboards:
- Industry-familiar components (enterprise devs recognize immediately)
- Keyboard-first (tab navigation, arrow keys, Enter/Space)
- Accessibility by default (WCAG 2.1 AA)
- HSL color system (easy dark mode, semantic colors)
- Rounded corners (6–8px, modern feel)
- Soft shadows (subtle depth)

### Visual Identity

#### Color Palette (HSL)

```css
/* HSL semantic colors (Tailwind v4 compatible) */
:root {
  --background: 0 0% 100%;           /* White background */
  --foreground: 222.2 84% 4.9%;      /* Near-black text */
  
  --primary: 221.2 83.2% 53.3%;      /* Blue (primary actions) */
  --primary-foreground: 210 40% 98%; /* Light text on primary */
  
  --accent: 217.2 91.2% 59.8%;       /* Blue-accent (secondary emphasis) */
  --accent-foreground: 210 40% 98%;
  
  --destructive: 0 84.2% 60.2%;      /* Red (delete, cancel) */
  --destructive-foreground: 210 40% 98%;
  
  --success: 142.3 76.2% 36.3%;      /* Green (confirm, success) */
  --warning: 38.6 92.1% 50.1%;       /* Amber (caution, incomplete) */
  --info: 217.2 91.2% 59.8%;         /* Blue (information) */
  
  --muted: 210 40% 96%;              /* Gray (disabled, secondary) */
  --muted-foreground: 215.4 16.3% 46.9%;
  
  --border: 214.3 31.8% 91.4%;       /* Light gray (borders) */
  --ring: 221.2 83.2% 53.3%;         /* Blue (focus ring, matches primary) */
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --background: 222.2 84% 4.9%;    /* Dark background */
    --foreground: 210 40% 98%;       /* Light text */
    --primary: 217.2 91.2% 59.8%;
    --muted: 217.2 32.6% 17.5%;
    /* etc. (shadcn provides full palette) */
  }
}
```

#### Typography

| Use | Font | Size | Weight | Notes |
|-----|------|------|--------|-------|
| **Display** | System sans | 28px | 700 | Page titles |
| **Heading** (H2) | System sans | 24px | 600 | Section headers |
| **Subheading** (H3) | System sans | 18px | 600 | Subsection |
| **Body** | System sans | 14px | 400 | Default text, tables, lists |
| **Small** | System sans | 12px | 400 | Captions, helper text |
| **Mono** | System mono (Courier, Menlo, Monaco) | 13px | 400 | Code, IDs, technical values |

**System fonts (no external imports):**
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
```

#### Border Radius & Shadows

```css
/* shadcn default: 6–8px rounded corners */
:root {
  --radius: 0.5rem;  /* 8px (default for cards, buttons) */
}

.rounded-sm { border-radius: 0.25rem; }  /* 4px (small buttons, inputs) */
.rounded-md { border-radius: 0.5rem; }   /* 8px (default) */
.rounded-lg { border-radius: 0.75rem; }  /* 12px (modals, drawers) */

/* Soft shadows (not stark) */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
```

### Components

#### Buttons

```tsx
// Primary (blue background)
<Button>Create Product</Button>

// Secondary (outline)
<Button variant="outline">Cancel</Button>

// Destructive (red, for delete/cancel actions)
<Button variant="destructive">Delete Order</Button>

// Ghost (minimal, text-only)
<Button variant="ghost">Learn more</Button>

// Disabled
<Button disabled>Save (processing...)</Button>
```

#### Tables (TanStack Table v8)

```tsx
// Product listing table
<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-border">
      <th className="text-left font-semibold p-2">Product</th>
      <th className="text-right font-semibold p-2">Price</th>
      <th className="text-center font-semibold p-2">Actions</th>
    </tr>
  </thead>
  <tbody>
    {products.map(product => (
      <tr key={product.id} className="border-b border-border hover:bg-muted">
        <td className="p-2">{product.name}</td>
        <td className="text-right p-2">${product.price / 100}</td>
        <td className="text-center p-2">
          <Button variant="ghost" size="sm">Edit</Button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Rules:**
- Alternating row hover (slightly lighter bg)
- Zebra striping optional (light gray rows)
- Sortable headers (up/down chevrons indicate sort direction)
- Pagination controls below table

#### Forms (react-hook-form + Zod)

```tsx
// Product form with validation
<form onSubmit={handleSubmit(onSubmit)}>
  <div className="space-y-4">
    <div>
      <Label htmlFor="name">Product Name</Label>
      <Input
        {...register('name', { required: 'Required' })}
        id="name"
        placeholder="e.g., T-Shirt"
      />
      {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
    </div>
    
    <div>
      <Label htmlFor="price">Price (USD)</Label>
      <Input
        {...register('price', { required: 'Required', pattern: /^\d+$/ })}
        id="price"
        type="number"
        placeholder="e.g., 2999 (cents)"
      />
    </div>
    
    <div>
      <Label>Category</Label>
      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
        <SelectTrigger>
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map(cat => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    
    <Button type="submit">Save Product</Button>
  </div>
</form>
```

#### Charts (Recharts)

```tsx
// Revenue trend
<LineChart width={500} height={300} data={revenueData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" />
</LineChart>

// Order status breakdown
<PieChart width={400} height={400}>
  <Pie data={statusData} cx="50%" cy="50%" labelLine={false} label={renderLabel}>
    {statusData.map((entry, index) => (
      <Cell key={`cell-${index}`} fill={entry.fill} />
    ))}
  </Pie>
</PieChart>
```

#### Modals & Dialogs

```tsx
// Confirm delete
<AlertDialog open={open} onOpenChange={setOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Order</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. The order will be permanently deleted.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-destructive text-destructive-foreground">
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Admin Pages

| Page | Path | Purpose | Key Patterns |
|------|------|---------|--------------|
| **Dashboard** | `/dashboard` | KPI cards, trends, alerts | Grid layout, Recharts, status badges |
| **Products** | `/dashboard/products` | List, search, CRUD | TanStack Table, bulk actions, filters |
| **Product Detail** | `/dashboard/products/:id` | Edit, SKU management | Form with Zod validation, tabs for SKUs |
| **Orders** | `/dashboard/orders` | View, fulfillment, status | Table with status badges, actions dropdown |
| **Order Detail** | `/dashboard/orders/:id` | Fulfillment actions, timeline | Status timeline, action buttons, order summary |
| **Users** | `/dashboard/users` | Customer list (readonly) | Table, filters, view customer orders |
| **Settings** | `/dashboard/settings` | Admin preferences, config | Tabs, form sections, save feedback |

---

## Accessibility Standards (Both)

### WCAG 2.1 Level AA (Mandatory)

| Requirement | Storefront | Admin |
|-------------|-----------|-------|
| **Color Contrast** | 4.5:1 text, 3:1 graphics | 4.5:1 text, 3:1 graphics |
| **Keyboard Navigation** | Tab, Enter, Arrow keys | Full keyboard support (all interactive elements) |
| **Focus Indicator** | Visible 2px ring | Visible 2px ring (primary color) |
| **Alt Text** | All product images | Icons (decorative use aria-hidden) |
| **Form Labels** | Associated `<label>` elements | Associated labels + ARIA aria-label if needed |
| **Motion** | Respects prefers-reduced-motion | Respects prefers-reduced-motion |
| **Text Sizing** | Readable at 200% zoom | Readable at 200% zoom |
| **Language** | `<html lang="en">` | `<html lang="en">` |

### Testing

```bash
# Automated accessibility testing (Playwright)
npm install -D @axe-core/playwright

# Manual testing
# 1. Keyboard only: Tab through entire site without mouse
# 2. Screen reader: NVDA (Windows), JAWS (commercial), VoiceOver (Mac)
# 3. Zoom: 200% text zoom, ensure layout doesn't break
# 4. Color blindness: Chrome DevTools Rendering > Emulate CSS media feature prefers-color-scheme
```

---

## Dark Mode Implementation

### Storefront (CSS Variables)

```css
/* Light mode (default) */
:root {
  --bg: rgb(250, 250, 250);
  --fg: rgb(39, 39, 42);
  /* ... */
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --bg: rgb(24, 24, 27);
    --fg: rgb(250, 250, 250);
    /* ... */
  }
}

/* Allow manual toggle (optional) */
html[data-theme="dark"] {
  color-scheme: dark;
  /* override variables */
}
```

### Admin (Tailwind dark mode)

```tsx
// Enable in next.config.js:
// darkMode: 'class'

// Toggle in layout:
<button onClick={() => setDarkMode(!darkMode)}>
  {darkMode ? <SunIcon /> : <MoonIcon />}
</button>

// Use dark: prefix in Tailwind:
<div className="bg-white dark:bg-zinc-950">
  {/* light bg on light mode, dark bg on dark mode */}
</div>
```

---

## Common Interaction Patterns

### Loading States

```tsx
// Storefront: Skeleton shimmer
<div className="animate-shimmer h-64 bg-border rounded-md" />

// Admin: Spinner + disabled button
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Saving...
</Button>
```

### Error Feedback

```tsx
// Storefront: Toast notification (top-right, auto-dismiss 3s)
<Toast variant="error">
  Unable to add item to cart. Please try again.
</Toast>

// Admin: Inline error + form field highlight
{errors.price && (
  <p className="text-sm text-destructive mt-1">{errors.price.message}</p>
)}
```

### Success Feedback

```tsx
// Both: Toast notification
<Toast variant="success">
  Order confirmed! Check your email for details.
</Toast>

// Admin: Button feedback
<Button onClick={handleSave} disabled={isSaving}>
  {isSaving ? 'Saving...' : 'Save'}
</Button>
```

### Empty States

```tsx
// Storefront: Hero message + CTA
<div className="text-center py-12">
  <p className="text-fg-muted mb-4">Your cart is empty</p>
  <a href="/products" className="text-accent hover:underline">
    Continue shopping
  </a>
</div>

// Admin: Icon + message + action
<div className="flex flex-col items-center justify-center py-12 text-center">
  <BoxIcon className="h-12 w-12 text-muted-foreground mb-4" />
  <p className="text-muted-foreground">No products found</p>
  <Button className="mt-4" variant="outline">
    Create Product
  </Button>
</div>
```

---

## Responsive Design Breakpoints (Tailwind)

```
sm: 640px   (tablets, landscape phones)
md: 768px   (tablets, small desktops)
lg: 1024px  (desktops)
xl: 1280px  (large desktops)
2xl: 1536px (ultra-wide)

Mobile-first: default = mobile, sm: = tablet up, lg: = desktop up
```

---

## Performance Considerations

### Storefront
- **Image Optimization:** Next.js `<Image>` component (auto-sized, AVIF/WebP)
- **Code Splitting:** Route-based code splitting (Next.js App Router default)
- **Lazy Loading:** Images below fold, modal components on-demand
- **Bundle Size:** Keep inline CSS, defer analytics scripts

### Admin
- **Table Virtualization:** TanStack Table with virtualizing for 10k+ rows
- **Query Caching:** React Query staleTime (5 min for products, 1 min for orders)
- **Form Performance:** Uncontrolled inputs (react-hook-form default)

---

## NextAuth Configuration

### Storefront (Credentials + Google OAuth Placeholder)

```typescript
// lib/auth-config.ts
export const authConfig = {
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Call /auth/login endpoint
        const res = await fetch(`${process.env.INTERNAL_API_URL}/auth/login`, {
          method: 'POST',
          body: JSON.stringify(credentials),
          headers: { 'Content-Type': 'application/json' },
        });
        const user = await res.json();
        return user ? { ...user, tokens: user.tokens } : null;
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login?error=auth',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.tokens.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.accessToken = token.accessToken;
      return session;
    },
  },
};
```

### Admin (Credentials Only, Role-Based)

```typescript
// Similar to storefront, but restrict to role === 'admin'
async authorize(credentials) {
  const user = await loginUser(credentials);
  if (user && user.role === 'admin') {
    return user;
  }
  return null;
}
```

---

## Open Questions

1. **Should storefront support RTC (real-time cart sync)?** Currently guest carts don't sync across tabs; low priority for MVP
2. **Admin role hierarchy (admin/moderator/viewer)?** Not yet scoped; single "admin" role sufficient for MVP
3. **Internationalization (i18n) for multiple languages?** Not in scope; English only for MVP; i18n deferred (future)

