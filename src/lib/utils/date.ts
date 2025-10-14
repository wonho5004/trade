export function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString('ko-KR', {
    hour12: false
  });
}
