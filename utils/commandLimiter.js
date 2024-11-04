const rateLimitStore = new Map();

export function isRateLimited(userId, maxCommandsPerMinute) {
  const currentTime = Date.now();
  const windowTime = 60 * 1000; // 1 minute in milliseconds

  if (!rateLimitStore.has(userId)) {
    rateLimitStore.set(userId, { count: 1, startTime: currentTime });
    return false;
  }

  const userData = rateLimitStore.get(userId);
  const elapsedTime = currentTime - userData.startTime;

  if (elapsedTime > windowTime) {
    // Reset the count and start time if the time window has passed
    rateLimitStore.set(userId, { count: 1, startTime: currentTime });
    return false;
  }

  if (userData.count >= maxCommandsPerMinute) {
    return true;
  }

  // Increment the count if within the time window
  userData.count += 1;
  return false;
}