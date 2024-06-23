#!/bin/bash

# Infinite loop to restart the command whenever it exits
while true; do
  # Execute the Node.js command
  node ace queue:listen --queue=snapshot

  # Wait for a second before restarting to avoid spamming in case of immediate failure
  sleep 1
done