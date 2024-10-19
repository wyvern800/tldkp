// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertFirestoreTimestamp(timestamp: any) {
  // Convert Firestore _seconds and _nanoseconds to milliseconds
  const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
  return date;
}