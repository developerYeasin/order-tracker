# Custom Hooks Library

Modern React hooks for data fetching and state management.

## Hooks

### useOrders
Fetch and manage all orders with filtering.

```jsx
import { useOrders } from './hooks'

function OrdersPage() {
  const {
    orders,
    loading,
    error,
    filters,
    setFilters,
    updateOrder,
    updateOrderStatus,
    updateOrderPosition,
    deleteOrder,
    bulkDeleteOrders,
    refresh,
  } = useOrders()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      {orders.map(order => (
        <OrderRow key={order.id} order={order} />
      ))}
    </div>
  )
}
```

**Returns:**
- `orders` - Array of orders
- `loading` - Boolean loading state
- `error` - Error message or null
- `filters` - Current filter object
- `setFilters` - Function to update filters
- `updateOrder(id, data)` - Update order
- `updateOrderStatus(id, statusData)` - Update order status
- `updateOrderPosition(id, position)` - Update order position (for kanban)
- `deleteOrder(id)` - Delete single order
- `bulkDeleteOrders(ids)` - Bulk delete orders
- `refresh()` - Refetch orders

### useOrder
Fetch and manage a single order by ID.

```jsx
import { useOrder } from './hooks'

function OrderDetail({ orderId }) {
  const {
    order,
    loading,
    error,
    update,
    updateStatus,
    refreshWithItems,
  } = useOrder(orderId)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h1>Order #{order.id}</h1>
      <button onClick={() => update({ price: 100 })}>Update Price</button>
    </div>
  )
}
```

**Returns:**
- `order` - Order object
- `loading` - Boolean loading state
- `error` - Error message or null
- `update(data)` - Update order
- `updateStatus(statusData)` - Update order status
- `refresh()` - Refetch order
- `refreshWithItems()` - Refetch order with items included

### useOrderItems
Fetch and manage items for an order.

```jsx
import { useOrderItems } from './hooks'

function OrderItems({ orderId }) {
  const {
    items,
    loading,
    error,
    createItem,
    updateItem,
    deleteItem,
  } = useOrderItems(orderId)

  const handleAdd = async () => {
    await createItem({ size: 'M', quantity: 1 })
  }

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>
          <span>{item.size} - {item.quantity}</span>
          <button onClick={() => deleteItem(item.id)}>Delete</button>
        </div>
      ))}
      <button onClick={handleAdd}>Add Item</button>
    </div>
  )
}
```

**Returns:**
- `items` - Array of order items
- `loading` - Boolean loading state
- `error` - Error message or null
- `createItem(itemData)` - Create new item
- `updateItem(itemId, updates)` - Update item
- `deleteItem(itemId)` - Delete item
- `refresh()` - Refetch items

### useMedia
Fetch and manage media/files for an order.

```jsx
import { useMedia } from './hooks'

function OrderMedia({ orderId }) {
  const {
    media,
    loading,
    error,
    uploadMedia,
    uploadDesignFiles,
    deleteMedia,
    downloadMedia,
    refresh,
  } = useMedia(orderId)

  const handleUpload = async (files) => {
    await uploadMedia(files) // Upload to order level
    // Or: await uploadDesignFiles(files) // Mark as design files
  }

  return (
    <div>
      {media.map(m => (
        <div key={m.id}>
          {m.file_url}
          <button onClick={() => downloadMedia(m)}>Download</button>
          <button onClick={() => deleteMedia(m.id)}>Delete</button>
        </div>
      ))}
    </div>
  )
}
```

**Returns:**
- `media` - Array of media objects
- `loading` - Boolean loading state
- `error` - Error message or null
- `uploadMedia(files, itemId?, side?)` - Upload files (order-level or item-level)
- `uploadDesignFiles(files)` - Upload design files (marked as design)
- `deleteMedia(mediaId)` - Delete media
- `downloadMedia(media)` - Download media file
- `refresh()` - Refetch media

### useDebounce
Debounce a value (useful for search inputs).

```jsx
import { useDebounce } from './hooks'

function SearchComponent() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 500)

  useEffect(() => {
    // This will only fire 500ms after user stops typing
    fetchResults(debouncedSearch)
  }, [debouncedSearch])

  return <input value={search} onChange={e => setSearch(e.target.value)} />
}
```

### useLocalStorage
Persist state to localStorage.

```jsx
import { useLocalStorage } from './hooks'

function ThemeToggle() {
  const [darkMode, setDarkMode] = useLocalStorage('darkMode', false)

  return (
    <button onClick={() => setDarkMode(!darkMode)}>
      {darkMode ? 'Light' : 'Dark'}
    </button>
  )
}
```

### usePrevious
Get the previous value of a state.

```jsx
import { usePrevious } from './hooks'

function Component() {
  const [count, setCount] = useState(0)
  const prevCount = usePrevious(count)

  useEffect(() => {
    console.log(`Count changed from ${prevCount} to ${count}`)
  }, [count, prevCount])

  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
}
```

### useOnClickOutside
Detect clicks outside a ref element.

```jsx
import { useOnClickOutside } from './hooks'

function Dropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useOnClickOutside(ref, () => setOpen(false))

  return (
    <div ref={ref}>
      <button onClick={() => setOpen(!open)}>Toggle</button>
      {open && <div>Dropdown content</div>}
    </div>
  )
}
```

## Benefits

- **Consistent API** - All hooks follow similar patterns
- **Optimistic updates** - Local state updates before server response
- **Error handling** - Built-in error states
- **TypeScript ready** - Easy to add types
- **No external dependencies** - Uses native React hooks only
