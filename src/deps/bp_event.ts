const listener = Symbol('event_listener');
const listeners = Symbol('event_listeners');

export class DestructibleEventListener {
  constructor(eventListener: any) {
    this[listener] = eventListener;
    this[listeners] = new Map();
  }

  public clear() {
    if (this[listeners]) {
      for (const entry of this[listeners]) {
        for (const fn of entry[1]) {
          this[listener].removeEventListener(entry[0], fn);
        }
      }
    }
    this[listeners].clear();
  }

  public destroy() {
    this.clear();
    this[listeners] = null;
  }

  public on(event: string, selector: any, fn: any) {
    if (fn === undefined) {
      fn = selector;
      selector = null;
    }
    if (selector) {
      return this.addEventListener(event, (e) => {
        if (e.target.matches(selector)) {
          fn(e);
        }
      });
    } else {
      return this.addEventListener(event, fn);
    }
  }

  public addEventListener(event: string, fn: any) {
    if (!this[listeners].has(event)) {
      this[listeners].set(event, new Set());
    }
    this[listeners].get(event).add(fn);
    this[listener].addEventListener(event, fn, false);
    return fn;
  }

  public removeEventListener(event: string, fn: any) {
    this[listener].removeEventListener(event, fn, false);
    if (this[listeners].has(event)) {
      // this[listeners].set(event, new Set());
      const ev = this[listeners].get(event);
      ev.delete(fn);
      if (!ev.size) {
        this[listeners].delete(event);
      }
    }
  }

  public dispatchEvent(event: string) {
    if (this[listener]) {
      this[listener].dispatchEvent(event);
    }
  }
}

export class EventEmitter {
  constructor(element = null) {
    this[listener] = new DestructibleEventListener(element || document.createElement('div'));
  }

  public clear() {
    if (this[listener]) {
      this[listener].clear();
    }
  }

  public destroy() {
    if (this[listener]) {
      this[listener].destroy();
      this[listener] = null;
    }
  }

  public on(event: string, selector: any, fn: any) {
    if (this[listener]) {
      return this[listener].on(event, selector, fn);
    }
    return null;
  }

  public addEventListener(event: string, fn: any) {
    if (this[listener]) {
      return this[listener].addEventListener(event, fn, false);
    }
    return null;
  }

  public removeEventListener(event: string, fn: any) {
    if (this[listener]) {
      this[listener].removeEventListener(event, fn, false);
    }
  }

  public dispatchEvent(event: string, data?: any) {
    if (this[listener]) {
      this[listener].dispatchEvent(new CustomEvent(event, { detail: data }));
    }
  }
}

export class EventSourceWrapper {
  public eventSource: EventEmitter;
  constructor(eventSource: EventEmitter) {
    this.eventSource = eventSource;
    this[listeners] = new Map();
  }

  public on(event: string, selector: any, fn?: any) {
    if (!this[listeners].has(event)) {
      this[listeners].set(event, new Set());
    }
    const listener = this.eventSource.on(event, selector, fn);
    if (listener) {
      this[listeners].get(event).add(listener);
    }
  }

  public off(event: string, fn: any) {
    this.eventSource.removeEventListener(event, fn);
  }

  public clear() {
    this.eventSource.clear();
    this[listeners].clear();
  }

  public destroy() {
    this.eventSource.clear();
    this[listeners] = null;
    this.eventSource = null;
  }
}
