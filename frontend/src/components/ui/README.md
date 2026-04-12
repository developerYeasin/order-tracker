# UI Components Library

A modern, beautiful component library built with React and Tailwind CSS.

## Components

### Button
Modern button component with variants and sizes.

```jsx
import { Button, IconButton } from './components/ui'

// Usage
<Button variant="primary" size="md" onClick={handleClick}>
  Primary Button
</Button>

<IconButton variant="primary" size="md" onClick={handleClick}>
  <svg>...</svg>
</IconButton>
```

**Variants:** `primary`, `secondary`, `danger`, `success`, `outline`, `ghost`
**Sizes:** `sm`, `md`, `lg`, `xl`

### Badge
Status badges and labels.

```jsx
import { Badge, StatusBadge } from './components/ui'

<Badge variant="primary" size="md">Primary</Badge>
<StatusBadge status={order.status?.delivery_status} />
```

**Variants:** `default`, `primary`, `success`, `warning`, `danger`, `purple`, `cyan`
**Sizes:** `sm`, `md`, `lg`

### Card
Container component with hover effects and gradients.

```jsx
import { Card, CardHeader, CardContent, CardFooter, StatCard, EmptyState } from './components/ui'

<Card hover gradient>
  <CardHeader>Header</CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>

<StatCard label="Total Orders" value={totalOrders} gradient="from-primary-500/20 to-primary-500/5" />
```

### Skeleton
Beautiful skeleton loaders with shimmer animations.

```jsx
import {
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  OrderCardSkeleton,
  ColumnSkeleton,
  ModalSkeleton,
  DashboardSkeleton
} from './components/ui'

// Full dashboard loading
if (loading) return <DashboardSkeleton />

// Individual card loading
<CardSkeleton />

// Table loading
<TableSkeleton rows={10} columns={6} />
```

### Layout
Loading overlay and page wrapper.

```jsx
import { LoadingOverlay, PageLoading } from './components/ui'

<LoadingOverlay loading={true} text="Loading..." />
```

## Design System

### Colors
- **Primary:** Blue gradient (`primary-500` to `primary-400`)
- **Success:** Emerald green
- **Warning:** Amber/Orange
- **Danger:** Rose red
- **Accent:** Cyan, Purple, Pink, Teal

### Shadows
- `shadow-glow`: Primary glow effect
- `shadow-lg`: Large shadow
- `shadow-sm`: Small shadow

### Animations
- `animate-fade-in`: Fade in
- `animate-slide-up/down`: Slide animations
- `animate-scale-in`: Scale animation
- `animate-skeleton`: Shimmer for skeletons
- `hover:scale-105`: Hover scale effect
- `hover:shadow-glow`: Hover glow effect

### Border Radius
- `rounded-xl`: Cards and buttons
- `rounded-2xl`: Large containers
- `rounded-3xl`: Column headers and modals
- `rounded-full`: Pill badges, avatars

## Best Practices

1. **Always use the component library** instead of custom Tailwind classes for consistency
2. **Use semantic variants** (e.g., `danger` for delete actions, `success` for confirm)
3. **Include proper loading states** using Skeleton components
4. **Use IconButton** for icon-only buttons with tooltips
5. **Wrap forms in Card** with CardHeader, CardContent, CardFooter

## Example: Modern Order Card

```jsx
import { Card, Badge, Button } from './components/ui'

const OrderCard = ({ order }) => (
  <Card hover gradient>
    <div className="flex justify-between items-start mb-4">
      <Badge variant="primary">#{order.id}</Badge>
      <Badge variant={order.priority === 'urgent' ? 'danger' : 'default'}>
        {order.priority}
      </Badge>
    </div>
    <h3 className="text-white font-bold text-lg mb-2">{order.customer_name}</h3>
    <div className="flex gap-2 mb-4">
      <Badge variant="primary">{order.items?.length} items</Badge>
      <Badge variant="success">৳{order.price}</Badge>
    </div>
    <div className="flex gap-2">
      <Button variant="primary" size="sm">Edit</Button>
      <Button variant="outline" size="sm">View</Button>
    </div>
  </Card>
)
```
