const express = require('express');

// Start the app but don't listen
process.env.SKIP_LISTEN = 'true';
const app = require('../dist/index.js');

// Function to print route stack
function printStack(stack, prefix = '') {
  stack.forEach((layer, index) => {
    if (layer.route) {
      // Route layer
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      console.log(`${prefix}[${index}] ${methods} ${layer.route.path}`);
    } else if (layer.name === 'router') {
      // Router middleware
      const path = layer.regexp.toString().match(/\\\/([^\\]+)/);
      console.log(`${prefix}[${index}] ROUTER at ${path ? '/' + path[1] : layer.regexp}`);
      if (layer.handle.stack) {
        printStack(layer.handle.stack, prefix + '  ');
      }
    } else {
      // Other middleware
      console.log(`${prefix}[${index}] ${layer.name || 'anonymous'} at ${layer.regexp || '/'}`);
    }
  });
}

console.log('=== APP ROUTES ===');
if (app._router && app._router.stack) {
  printStack(app._router.stack);
} else {
  console.log('App router not available');
}
