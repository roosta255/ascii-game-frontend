export interface TimeRef {
  serverToClientOffset: number;
  lastServerTime: number;
  lastClientTime: number;
  fetchTime: number;
}

export function updateTimeRef(times: TimeRef, serverTime: number) {
  const now = performance.now();
  if (serverTime >= times.lastServerTime) {
    const serverToClientOffset = now - serverTime;
    // console.log({"now": now, "serverToClientOffset": serverToClientOffset, "serverTime": serverTime, "lastServerTime": times.lastServerTime});
    times.lastServerTime = serverTime;
    times.lastClientTime = now;
    times.serverToClientOffset = serverToClientOffset;
    times.fetchTime = now - serverToClientOffset;
  } else {
    // console.log({"now": now, "serverToClientOffset": "not calculated, due to outdated serverTime", "serverTime": serverTime, "lastServerTime": times.lastServerTime});
  }
}