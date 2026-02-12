// Clarity PWA Service Worker
// Handles notification clicks and actions

const APP_URL = self.location.origin;

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(clients.claim());
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  console.log('Action:', event.action);
  console.log('Data:', event.notification.data);
  
  event.notification.close();
  
  // Get the action (if button was clicked) or default action
  const action = event.action;
  const data = event.notification.data || {};
  
  // Build the URL path
  let urlPath = '/';
  let messageData = {
    type: 'NOTIFICATION_ACTION',
    screen: null,
    autoSubmitValue: null
  };
  
  if (action) {
    // Action button was clicked - include the selected value
    const selectedValue = parseInt(action);
    urlPath = data.screen || '/';
    messageData.screen = data.screen;
    messageData.autoSubmitValue = selectedValue;
  } else {
    // Notification body was clicked - just open the check-in screen
    urlPath = data.screen || '/';
    messageData.screen = data.screen;
  }
  
  // Build URL with query params for better Firefox handling
  const fullUrl = action 
    ? `${APP_URL}${urlPath}${urlPath.includes('?') ? '&' : '?'}autoSubmit=${action}`
    : `${APP_URL}${urlPath}`;
  
  console.log('Target URL:', fullUrl);
  
  // Try to focus existing window or open new one
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      console.log('Found clients:', clientList.length);
      
      // Look for an existing window in the app's scope
      for (const client of clientList) {
        console.log('Client URL:', client.url);
        
        // Check if this client is part of the PWA (same origin)
        // For Firefox, be more lenient with matching
        const isAppClient = client.url.startsWith(APP_URL) || 
                           client.url.includes(new URL(APP_URL).hostname);
        
        if (isAppClient && 'focus' in client) {
          console.log('Focusing existing client');
          
          // Focus the window and send navigation message
          return client.focus().then((focusedClient) => {
            console.log('Sending message to client:', messageData);
            focusedClient.postMessage(messageData);
            return focusedClient;
          });
        }
      }
      
      // No existing window found - open a new one
      console.log('Opening new window:', fullUrl);
      if (clients.openWindow) {
        // Use the full URL with params for better cross-browser support
        return clients.openWindow(fullUrl);
      }
    }).catch(error => {
      console.error('Error handling notification click:', error);
    })
  );
});

// Handle push events (for future server-sent notifications)
self.addEventListener('push', (event) => {
  console.log('Push received:', event);
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: data.icon || '/icon.png',
      badge: '/icon.png',
      data: data.data || {},
      actions: data.actions || [],
      requireInteraction: false,
      tag: data.tag || 'clarity-notification'
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});
