# Reactive Framework

A lightweight, Vue-inspired reactive framework that brings reactivity and declarative DOM bindings to vanilla JavaScript.

## Features

- ✨ **Reactive State Management** - `ref()`, `reactive()`, `computed()`
- 🎯 **Declarative DOM Bindings** - Text, attributes, events, classes, and more
- 🔄 **Two-Way Data Binding** - Automatic input synchronization
- 👀 **Watchers** - React to state changes
- ⚡ **Automatic Updates** - Efficient batched DOM updates
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
- MutationObserver

---

## License

MIT
