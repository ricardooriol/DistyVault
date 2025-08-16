/**
 * EventBus - Event management and communication between components
 */
class EventBus {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Map();
        this.debugMode = false;
    }

    /**
     * Subscribe to an event
     */
    on(eventName, callback, context = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }

        const listener = {
            callback,
            context,
            id: this.generateId()
        };

        this.events.get(eventName).push(listener);

        if (this.debugMode) {
            console.log(`EventBus: Subscribed to '${eventName}'`, listener);
        }

        // Return unsubscribe function
        return () => this.off(eventName, listener.id);
    }

    /**
     * Subscribe to an event that will only fire once
     */
    once(eventName, callback, context = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this.onceEvents.has(eventName)) {
            this.onceEvents.set(eventName, []);
        }

        const listener = {
            callback,
            context,
            id: this.generateId()
        };

        this.onceEvents.get(eventName).push(listener);

        if (this.debugMode) {
            console.log(`EventBus: Subscribed once to '${eventName}'`, listener);
        }

        // Return unsubscribe function
        return () => this.offOnce(eventName, listener.id);
    }

    /**
     * Unsubscribe from an event
     */
    off(eventName, listenerId = null) {
        if (!listenerId) {
            // Remove all listeners for this event
            this.events.delete(eventName);
            if (this.debugMode) {
                console.log(`EventBus: Removed all listeners for '${eventName}'`);
            }
            return;
        }

        const listeners = this.events.get(eventName);
        if (listeners) {
            const index = listeners.findIndex(listener => listener.id === listenerId);
            if (index !== -1) {
                listeners.splice(index, 1);
                if (this.debugMode) {
                    console.log(`EventBus: Unsubscribed from '${eventName}'`, listenerId);
                }
            }

            // Clean up empty arrays
            if (listeners.length === 0) {
                this.events.delete(eventName);
            }
        }
    }

    /**
     * Unsubscribe from a once event
     */
    offOnce(eventName, listenerId = null) {
        if (!listenerId) {
            // Remove all once listeners for this event
            this.onceEvents.delete(eventName);
            return;
        }

        const listeners = this.onceEvents.get(eventName);
        if (listeners) {
            const index = listeners.findIndex(listener => listener.id === listenerId);
            if (index !== -1) {
                listeners.splice(index, 1);
            }

            // Clean up empty arrays
            if (listeners.length === 0) {
                this.onceEvents.delete(eventName);
            }
        }
    }

    /**
     * Emit an event to all subscribers
     */
    emit(eventName, data = null) {
        if (this.debugMode) {
            console.log(`EventBus: Emitting '${eventName}'`, data);
        }

        let listenersNotified = 0;

        // Handle regular listeners
        const listeners = this.events.get(eventName);
        if (listeners) {
            // Create a copy to avoid issues if listeners are modified during iteration
            const listenersCopy = [...listeners];
            
            listenersCopy.forEach(listener => {
                try {
                    if (listener.context) {
                        listener.callback.call(listener.context, data);
                    } else {
                        listener.callback(data);
                    }
                    listenersNotified++;
                } catch (error) {
                    console.error(`EventBus: Error in listener for '${eventName}':`, error);
                }
            });
        }

        // Handle once listeners
        const onceListeners = this.onceEvents.get(eventName);
        if (onceListeners) {
            // Create a copy and clear the original array
            const onceListenersCopy = [...onceListeners];
            this.onceEvents.delete(eventName);

            onceListenersCopy.forEach(listener => {
                try {
                    if (listener.context) {
                        listener.callback.call(listener.context, data);
                    } else {
                        listener.callback(data);
                    }
                    listenersNotified++;
                } catch (error) {
                    console.error(`EventBus: Error in once listener for '${eventName}':`, error);
                }
            });
        }

        if (this.debugMode) {
            console.log(`EventBus: Notified ${listenersNotified} listeners for '${eventName}'`);
        }

        return listenersNotified;
    }

    /**
     * Emit an event asynchronously
     */
    async emitAsync(eventName, data = null) {
        if (this.debugMode) {
            console.log(`EventBus: Emitting async '${eventName}'`, data);
        }

        const promises = [];

        // Handle regular listeners
        const listeners = this.events.get(eventName);
        if (listeners) {
            const listenersCopy = [...listeners];
            
            listenersCopy.forEach(listener => {
                const promise = new Promise(async (resolve) => {
                    try {
                        let result;
                        if (listener.context) {
                            result = listener.callback.call(listener.context, data);
                        } else {
                            result = listener.callback(data);
                        }
                        
                        // Handle async callbacks
                        if (result instanceof Promise) {
                            await result;
                        }
                        
                        resolve();
                    } catch (error) {
                        console.error(`EventBus: Error in async listener for '${eventName}':`, error);
                        resolve();
                    }
                });
                promises.push(promise);
            });
        }

        // Handle once listeners
        const onceListeners = this.onceEvents.get(eventName);
        if (onceListeners) {
            const onceListenersCopy = [...onceListeners];
            this.onceEvents.delete(eventName);

            onceListenersCopy.forEach(listener => {
                const promise = new Promise(async (resolve) => {
                    try {
                        let result;
                        if (listener.context) {
                            result = listener.callback.call(listener.context, data);
                        } else {
                            result = listener.callback(data);
                        }
                        
                        // Handle async callbacks
                        if (result instanceof Promise) {
                            await result;
                        }
                        
                        resolve();
                    } catch (error) {
                        console.error(`EventBus: Error in async once listener for '${eventName}':`, error);
                        resolve();
                    }
                });
                promises.push(promise);
            });
        }

        await Promise.all(promises);

        if (this.debugMode) {
            console.log(`EventBus: Completed async emission for '${eventName}' with ${promises.length} listeners`);
        }

        return promises.length;
    }

    /**
     * Check if there are any listeners for an event
     */
    hasListeners(eventName) {
        const hasRegular = this.events.has(eventName) && this.events.get(eventName).length > 0;
        const hasOnce = this.onceEvents.has(eventName) && this.onceEvents.get(eventName).length > 0;
        return hasRegular || hasOnce;
    }

    /**
     * Get the number of listeners for an event
     */
    listenerCount(eventName) {
        const regularCount = this.events.has(eventName) ? this.events.get(eventName).length : 0;
        const onceCount = this.onceEvents.has(eventName) ? this.onceEvents.get(eventName).length : 0;
        return regularCount + onceCount;
    }

    /**
     * Get all event names that have listeners
     */
    eventNames() {
        const regularEvents = Array.from(this.events.keys());
        const onceEvents = Array.from(this.onceEvents.keys());
        return [...new Set([...regularEvents, ...onceEvents])];
    }

    /**
     * Clear all listeners
     */
    clear() {
        this.events.clear();
        this.onceEvents.clear();
        
        if (this.debugMode) {
            console.log('EventBus: Cleared all listeners');
        }
    }

    /**
     * Enable or disable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`EventBus: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Generate unique ID for listeners
     */
    generateId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create a namespaced event bus
     */
    namespace(prefix) {
        return {
            on: (eventName, callback, context) => this.on(`${prefix}:${eventName}`, callback, context),
            once: (eventName, callback, context) => this.once(`${prefix}:${eventName}`, callback, context),
            off: (eventName, listenerId) => this.off(`${prefix}:${eventName}`, listenerId),
            emit: (eventName, data) => this.emit(`${prefix}:${eventName}`, data),
            emitAsync: (eventName, data) => this.emitAsync(`${prefix}:${eventName}`, data)
        };
    }

    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            regularEvents: Object.fromEntries(
                Array.from(this.events.entries()).map(([name, listeners]) => [name, listeners.length])
            ),
            onceEvents: Object.fromEntries(
                Array.from(this.onceEvents.entries()).map(([name, listeners]) => [name, listeners.length])
            ),
            totalListeners: Array.from(this.events.values()).reduce((sum, listeners) => sum + listeners.length, 0) +
                           Array.from(this.onceEvents.values()).reduce((sum, listeners) => sum + listeners.length, 0)
        };
    }
}

// Common event names used throughout the application
EventBus.Events = {
    // Data events
    KNOWLEDGE_BASE_LOADED: 'knowledgeBase:loaded',
    KNOWLEDGE_BASE_UPDATED: 'knowledgeBase:updated',
    ITEM_ADDED: 'item:added',
    ITEM_UPDATED: 'item:updated',
    ITEM_DELETED: 'item:deleted',
    
    // Processing events
    PROCESSING_STARTED: 'processing:started',
    PROCESSING_PROGRESS: 'processing:progress',
    PROCESSING_COMPLETED: 'processing:completed',
    PROCESSING_FAILED: 'processing:failed',
    PROCESSING_STOPPED: 'processing:stopped',
    
    // UI events
    SELECTION_CHANGED: 'ui:selectionChanged',
    FILTER_CHANGED: 'ui:filterChanged',
    MODAL_OPENED: 'ui:modalOpened',
    MODAL_CLOSED: 'ui:modalClosed',
    
    // Settings events
    SETTINGS_LOADED: 'settings:loaded',
    SETTINGS_SAVED: 'settings:saved',
    SETTINGS_CHANGED: 'settings:changed',
    
    // Error events
    ERROR_OCCURRED: 'error:occurred',
    WARNING_OCCURRED: 'warning:occurred',
    
    // Status events
    STATUS_SHOWN: 'status:shown',
    STATUS_HIDDEN: 'status:hidden',
    STATUS_UPDATED: 'status:updated'
};