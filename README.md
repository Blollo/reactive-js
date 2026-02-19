# Reactive JS

A lightweight, Vue-inspired reactive framework that brings reactivity and declarative DOM bindings to vanilla JavaScript.

## Features

- ✨ **Reactive State Management** - `ref()`, `reactive()`, `computed()`
- 🎯 **Declarative DOM Bindings** - Text, attributes, events, classes, and more
- 🔄 **Two-Way Data Binding** - Automatic input synchronization
- 👀 **Watchers** - React to state changes
- ⚡ **Automatic Updates** - Efficient batched DOM updates
- 🧩 **Web Components** - Build encapsulated components with `ReactiveComponent`
- 🪶 **Lightweight** - No build step required

## Installation

Include the framework in your HTML:

```html
<script type="module">
  import { ref, reactive, computed, watch, effect, scanBindings } from './reactive.js';
</script>
```

## Core API

### `ref(value)`

Creates a reactive reference to a primitive value.

```javascript
const count = ref(0);
console.log(count.value); // 0

count.value = 5;
console.log(count.value); // 5
```

### `reactive(object)`

Creates a reactive proxy for an object with deep reactivity.

```javascript
const state = reactive({
  user: {
    name: 'Alice',
    age: 25
  }
});

state.user.name = 'Bob'; // Reactive!
```

### `computed(getter)`

Creates a computed value that automatically updates when dependencies change.

```javascript
const count = ref(5);
const doubled = computed(() => count.value * 2);

console.log(doubled.value); // 10

count.value = 10;
console.log(doubled.value); // 20 (updated automatically)
```

### `watch(source, callback, options)`

Watches a reactive value and executes a callback when it changes.

```javascript
const count = ref(0);

watch(count, (newValue, oldValue) => {
  console.log(`Count changed from ${oldValue} to ${newValue}`);
});

count.value = 5; // Triggers callback
```

**Options:**
- `immediate: true` - Execute callback immediately with current value
- `deep: true` - Deep watch for reactive objects

```javascript
const state = reactive({ count: 0 });

watch(
  () => state.count,
  (newVal) => console.log('Count:', newVal),
  { immediate: true }
);
```

### `effect(callback, options)`

Runs a callback immediately and re-runs it whenever reactive dependencies change.

```javascript
const count = ref(0);

effect(() => {
  console.log(`Count is: ${count.value}`);
});

count.value = 5; // Logs: "Count is: 5"
```

**Options:**
- `sync: true` - Run synchronously (used internally for computed)

## DOM Bindings

Use `scanBindings(element, store)` to activate reactive bindings in your HTML.

```javascript
const store = {
  count: ref(0),
  name: ref('Alice'),
  increment() {
    store.count.value++;
  }
};

scanBindings(document.body, store);
```

---

### Text Binding

#### `[text]` or `data-text`

Binds element's text content to a reactive value.

```html
<span [text]="count"></span>
<p data-text="name"></p>
```

```javascript
const store = {
  count: ref(42),
  name: ref('Alice')
};
```

---

### Interpolation

#### `{expression}`

Embed reactive values directly in text content.

```html
<p>Hello {name}!</p>
<p>Count: {count}, Doubled: {count * 2}</p>
<p>{firstName} {lastName}</p>
```

```javascript
const store = {
  name: ref('Alice'),
  count: ref(5),
  firstName: ref('John'),
  lastName: ref('Doe')
};
```

---

### Conditional Rendering

#### `[if]` or `data-if`

Conditionally renders an element (adds/removes from DOM).

```html
<div [if]="isVisible">
  This appears when isVisible is true
</div>

<p data-if="count > 10">
  Count is greater than 10!
</p>
```

```javascript
const store = {
  isVisible: ref(true),
  count: ref(15)
};
```

---

### Show/Hide

#### `[show]` or `data-show`

Toggles element visibility using `display: none` (keeps element in DOM).

```html
<div [show]="isVisible">
  This is hidden when isVisible is false
</div>
```

```javascript
const store = {
  isVisible: ref(true)
};
```

**Difference between `[if]` and `[show]`:**
- `[if]` - Removes element from DOM
- `[show]` - Hides element with CSS (faster toggling, preserves state)

---

### Two-Way Binding

#### `[model]` or `data-model`

Binds form inputs to reactive values (two-way binding).

```html
<!-- Text input -->
<input type="text" [model]="name" />

<!-- Checkbox -->
<input type="checkbox" [model]="isChecked" />

<!-- Number input -->
<input type="number" [model]="age" />

<!-- Textarea -->
<textarea [model]="message"></textarea>

<!-- Select -->
<select [model]="selected">
  <option value="a">Option A</option>
  <option value="b">Option B</option>
</select>
```

```javascript
const store = {
  name: ref(''),
  isChecked: ref(false),
  age: ref(0),
  message: ref(''),
  selected: ref('a')
};
```

---

### Class Binding

#### `[class]` or `data-class`

Dynamically adds classes to elements.

**String syntax:**
```html
<div [class]="classes">Styled</div>
```

```javascript
const store = {
  classes: ref('active bold')
};
```

**Object syntax:**
```html
<div [class]="{ active: isActive, error: hasError }">Status</div>
```

```javascript
const store = {
  isActive: ref(true),
  hasError: ref(false)
};
// Result: class="active"
```

---

### Dynamic Attributes

#### `:attribute` or `data-attr-attribute`

Binds element attributes to reactive values.

```html
<!-- Using : syntax -->
<a :href="url">Link</a>
<img :src="imageSrc" :alt="imageAlt" />
<button :disabled="isDisabled">Click</button>

<!-- Using data-attr- syntax -->
<div data-attr-id="elementId"></div>
<input data-attr-placeholder="placeholder" />
```

```javascript
const store = {
  url: ref('https://example.com'),
  imageSrc: ref('/image.jpg'),
  imageAlt: ref('Description'),
  isDisabled: ref(false),
  elementId: ref('item-1'),
  placeholder: ref('Enter text...')
};
```

---

### Event Handlers

#### `@event` or `data-onevent`

Binds event listeners to methods.

```html
<!-- Using @ syntax -->
<button @click="increment">+1</button>
<button @click="decrement">-1</button>
<input @input="handleInput" @blur="handleBlur" />

<!-- Using data-on syntax -->
<button data-onclick="reset">Reset</button>

<!-- With arguments -->
<button @click="addItem('Apple')">Add Apple</button>
<button @click="setCount(10)">Set to 10</button>

<!-- Event object access -->
<input @input="handleInput($event)" />
```

```javascript
const store = {
  count: ref(0),

  increment() {
    store.count.value++;
  },

  decrement() {
    store.count.value--;
  },

  reset() {
    store.count.value = 0;
  },

  addItem(item) {
    console.log('Adding:', item);
  },

  setCount(value) {
    store.count.value = value;
  },

  handleInput(event) {
    console.log('Input value:', event.target.value);
  },

  handleBlur() {
    console.log('Input lost focus');
  }
};
```

**Supported events:** `click`, `input`, `change`, `submit`, `focus`, `blur`, `keyup`, `keydown`, `mouseenter`, `mouseleave`, etc.

---

### List Rendering

#### `data-for`

Renders a list of elements from an array.

**Basic syntax:**
```html
<ul>
  <li data-for="item of items">{item}</li>
</ul>
```

```javascript
const store = {
  items: ref(['Apple', 'Banana', 'Cherry'])
};
```

**With index:**
```html
<ul>
  <li data-for="(item, index) of items">
    {index + 1}. {item}
  </li>
</ul>
```

**With objects:**
```html
<div data-for="user of users">
  <h3>{user.name}</h3>
  <p>Age: {user.age}</p>
</div>
```

```javascript
const store = {
  users: ref([
    { name: 'Alice', age: 25 },
    { name: 'Bob', age: 30 },
    { name: 'Charlie', age: 35 }
  ])
};
```

---

### Component Two-Way Binding

#### `model:prop-name`

Binds a parent store ref to a reactive prop on a child `ReactiveComponent`, keeping both sides in sync automatically.

```html
<my-counter model:count="appCount"></my-counter>
```

```javascript
const store = {
  appCount: ref(0)
};

scanBindings(document.body, store);
```

The directive handles both directions: when `appCount` changes in the parent the child's prop updates, and when the child emits `update:count` the parent ref is written back.

**Note:** `model:` only works with props declared as reactive (using the `ref()` marker) in the child's `static props`. Using it on a non-reactive prop throws an error.

**Difference between `[model]` and `model:`:**
- `[model]` - Two-way binding for native form inputs (`<input>`, `<select>`, `<textarea>`)
- `model:` - Two-way binding for `ReactiveComponent` custom element props

---

## Web Components

`ReactiveComponent` is a base class for building encapsulated custom elements. It wires the shadow DOM, reactive state, and props together so subclasses only need to declare what varies.

### Defining a Component

Extend `ReactiveComponent` and override `setup()`, `template()`, and optionally `style()`:

```javascript
import { ReactiveComponent } from './ReactiveComponent.js';
import { ref, computed } from './reactive.js';

class MyCounter extends ReactiveComponent {
  setup() {
    const count = ref(0);
    const double = computed(() => count.value * 2);

    const increment = () => count.value++;
    const decrement = () => count.value--;

    return { count, double, increment, decrement };
  }

  template() {
    return `
      <button @click="decrement">-</button>
      <span>{count} (x2: {double})</span>
      <button @click="increment">+</button>
    `;
  }

  style() {
    return `
      <style>
        :host { display: flex; gap: 8px; align-items: center; }
        button { padding: 4px 10px; }
      </style>
    `;
  }
}

customElements.define('my-counter', MyCounter);
```

```html
<my-counter></my-counter>
```

---

### Props

#### `static props`

Declares which HTML attributes the component accepts and their types. Props are available on `this.props` inside `setup()`.

Supported types: `String`, `Number`, `Boolean`, `Array`, `Object`.

```javascript
class MyCounter extends ReactiveComponent {
  static props = {
    label: String,        // non-reactive: plain value, does not update the DOM when changed
    count: ref(Number),   // reactive: becomes a ref, DOM updates automatically when the attribute changes
  };

  setup() {
    const count = this.props.count; // ref — already reactive
    const label = this.props.label; // plain string

    const increment = () => count.value++;

    return { count, label, increment };
  }

  template() {
    return `<button @click="increment">{label}: {count}</button>`;
  }
}

customElements.define('my-counter', MyCounter);
```

```html
<my-counter label="Score" count="0"></my-counter>
```

**Prop types and coercion:**

| Type | HTML attribute | `this.props` value |
|------|---------------|-------------------|
| `String` | `"hello"` | `"hello"` |
| `Number` | `"42"` | `42` |
| `Boolean` | `"false"` | `false` |
| `Array` | `"[1,2,3]"` | `[1, 2, 3]` |
| `Object` | `"{\"a\":1}"` | `{ a: 1 }` |

**Note:** Attribute names follow standard HTML kebab-case convention. They are automatically mapped to camelCase in `static props` and `this.props`.

```html
<!-- HTML attribute: kebab-case -->
<my-counter my-label="Score" initial-count="5"></my-counter>
```

```javascript
static props = {
  myLabel: String,          // maps to my-label attribute
  initialCount: ref(Number) // maps to initial-count attribute
};
```

**Note:** Passing an attribute that is not declared in `static props` throws an error.

---

### Lifecycle Hooks

Override these methods in your subclass to run code at specific points in the component's life.

#### `onMounted()`

Called once, immediately after the component's shadow DOM has been rendered and all bindings are active.

```javascript
class MyCounter extends ReactiveComponent {
  setup() {
    return { count: ref(0) };
  }

  onMounted() {
    console.log('Component is live');
  }

  template() {
    return `<span>{count}</span>`;
  }
}
```

#### `onUnmounted()`

Called when the component is removed from the DOM. All internal effects are stopped automatically after this hook runs.

```javascript
class MyTimer extends ReactiveComponent {
  setup() {
    const seconds = ref(0);
    this._interval = setInterval(() => seconds.value++, 1000);
    return { seconds };
  }

  onUnmounted() {
    clearInterval(this._interval);
  }

  template() {
    return `<span>{seconds}s</span>`;
  }
}
```

---

### Emitting Events

#### `this.emit(eventName, detail)`

Dispatches a composed, bubbling `CustomEvent` from the component element, allowing parent contexts to listen with `@eventname` or `addEventListener`.

```javascript
class MyInput extends ReactiveComponent {
  setup() {
    const value = ref('');

    const onInput = () => {
      this.emit('change', value.value);
    };

    return { value, onInput };
  }

  template() {
    return `<input [model]="value" @input="onInput" />`;
  }
}
```

```html
<!-- Parent listens with a standard event handler -->
<my-input @change="handleChange"></my-input>
```

---

### Two-Way Binding with `model:`

When a parent wants to keep one of its refs in sync with a child component's reactive prop, use the `model:` directive on the child element and have the child emit `update:<prop-name>` whenever the value changes internally.

```html
<!-- parent template -->
<my-counter model:count="appCount"></my-counter>
<p>App count: {appCount}</p>
```

```javascript
// parent store
const store = {
  appCount: ref(10)
};

scanBindings(document.body, store);
```

```javascript
// child component
class MyCounter extends ReactiveComponent {
  static props = {
    count: ref(Number)
  };

  setup() {
    const count = this.props.count;

    const increment = () => {
      count.value++;
      this.emit('update:count', count.value); // notify parent
    };

    return { count, increment };
  }

  template() {
    return `
      <span>{count}</span>
      <button @click="increment">+</button>
    `;
  }
}

customElements.define('my-counter', MyCounter);
```

**How it works:**
- **Parent → child:** when `appCount` changes, the `count` attribute on `<my-counter>` is updated automatically, which triggers `attributeChangedCallback` and updates the internal ref.
- **Child → parent:** when the child calls `this.emit('update:count', newValue)`, the directive catches the event and writes the new value back into `appCount`.

---

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Reactive Todo App</title>
</head>
<body>
  <div id="app">
    <h1>Todo List</h1>

    <!-- Input with two-way binding -->
    <input
      type="text"
      [model]="newTodo"
      @keyup.enter="addTodo"
      :placeholder="placeholder"
    />
    <button @click="addTodo">Add</button>

    <!-- Conditional rendering -->
    <p [if]="todos.length === 0">No todos yet!</p>

    <!-- List rendering -->
    <ul [show]="todos.length > 0">
      <li data-for="(todo, index) of todos">
        <span [class]="{ completed: todo.done }">
          {index + 1}. {todo.text}
        </span>
        <button @click="toggleTodo(index)">Toggle</button>
        <button @click="removeTodo(index)">Remove</button>
      </li>
    </ul>

    <!-- Computed values -->
    <p>Total: {todos.length} | Completed: {completedCount}</p>
  </div>

  <script type="module">
    import { ref, computed, scanBindings } from './reactive.js';

    const store = {
      newTodo: ref(''),
      placeholder: ref('What needs to be done?'),
      todos: ref([]),

      completedCount: computed(() =>
        store.todos.value.filter(t => t.done).length
      ),

      addTodo() {
        if (store.newTodo.value.trim()) {
          store.todos.value.push({
            text: store.newTodo.value,
            done: false
          });
          store.newTodo.value = '';
        }
      },

      toggleTodo(index) {
        store.todos.value[index].done = !store.todos.value[index].done;
      },

      removeTodo(index) {
        store.todos.value.splice(index, 1);
      }
    };

    scanBindings(document.getElementById('app'), store);
  </script>
</body>
</html>
```

---

## Best Practices

### 1. Use `ref()` for primitives, `reactive()` for objects

```javascript
// ✅ Good
const count = ref(0);
const user = reactive({ name: 'Alice', age: 25 });

// ❌ Avoid
const count = reactive({ value: 0 }); // Unnecessary wrapper
```

### 2. Use `computed()` for derived state

```javascript
// ✅ Good
const doubled = computed(() => count.value * 2);

// ❌ Avoid - manual updates
let doubled = count.value * 2;
watch(count, () => { doubled = count.value * 2; });
```

### 3. Cleanup effects when needed

```javascript
const runner = effect(() => {
  console.log(count.value);
});

// Later, when no longer needed
runner.stop();
```

### 4. Organize your store

```javascript
const store = {
  // State
  count: ref(0),
  user: reactive({ name: 'Alice' }),

  // Computed
  doubled: computed(() => store.count.value * 2),

  // Methods
  increment() {
    store.count.value++;
  }
};
```

### 5. Use appropriate conditional rendering

```javascript
// Use [if] for infrequent toggles (removes from DOM)
<div [if]="isLoggedIn">Dashboard</div>

// Use [show] for frequent toggles (keeps in DOM)
<div [show]="isMenuOpen">Menu</div>
```

### 6. Declare only what needs to update the DOM as a reactive prop

```javascript
// ✅ Good — only count drives DOM updates, label is static
static props = {
  label: String,
  count: ref(Number)
};

// ❌ Avoid — making everything reactive adds unnecessary overhead
static props = {
  label: ref(String),
  count: ref(Number)
};
```

### 7. Always emit `update:<prop-name>` when mutating a bound prop

When a component is used with `model:`, the parent relies on the child emitting the right event to stay in sync. Make it a habit to emit immediately after mutating a reactive prop.

```javascript
// ✅ Good
const increment = () => {
  count.value++;
  this.emit('update:count', count.value);
};

// ❌ Avoid — parent ref will drift out of sync
const increment = () => {
  count.value++;
};
```

---

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run DOM tests only
npm run test:dom

# Watch mode
npm run test:watch
```

---

## Browser Support

Works in all modern browsers that support:
- ES6 Proxy
- ES6 Modules
- Custom Elements (Web Components)
- MutationObserver

---

## License

MIT