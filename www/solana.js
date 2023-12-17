const web3 = window.solanaWeb3;

/**************************************************/
/* CONFIGURATION                                  */
/**************************************************/

const HTTP_RPC_URL = "http://localhost:8899";
const WS_RPC_URL = "ws://localhost:8900";

/**************************************************/

const b58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
// prettier-ignore
const toBase58 = function(B,A=b58Chars){var d=[],s="",i,j,c,n;for(i in B){j=0,c=B[i];s+=c||s.length^i?"":1;while(j in d||c){n=d[j];n=n?n*256+c:c;c=n/58|0;d[j]=n%58;j++}}while(j--)s+=A[d[j]];return s};
// prettier-ignore
const fromBase58 = function(S,A=b58Chars){var d=[],b=[],i,j,c,n;for(i in S){j=0,c=A.indexOf(S[i]);if(c<0)return undefined;c||b.length^i?i:b.push(0);while(j in d||c){n=d[j];n=n?n*58+c:c;c=n>>8;d[j]=n%256;j++}}while(j--)b.push(d[j]);return new Uint8Array(b)};

// 0 - idle
// 1 - pending
// 2 - connected
let connectingState = 0;
let userPubkey = null;
let ws = false;
let wsRequestQueue = [];
const webSocketRequests = new Map();
window.turboSolUser = () => {
  if (!ws) {
    ws = new WebSocket(WS_RPC_URL);
    ws.onopen = () => {
      console.log("Connected to WebSocket!");
      for (const req of wsRequestQueue) {
        ws.send(req);
      }
      wsRequestQueue = [];
    };
    ws.onclose = () => {
      console.log("WebSocket closed!");
      ws = null;
    };
    ws.onmessage = (e) => {
      console.log("WebSocket message:", e.data);
      const res = JSON.parse(e.data);
      const req = webSocketRequests.get(res.id);
      if (res.method === "accountNotification") {
        const { params } = res;
        console.log("accountNotification", params);
        for (const [_pubkey, queryResult] of accountStore) {
          if (queryResult.wsSubscriptionId === params.subscription) {
            if ("error" in params) {
              queryResult.context = context;
              queryResult.error =
                params.error.message ?? "Error in WebSocket notification";
              queryResult.updatedAt = Date.now();
            } else {
              const { context, value } = params.result;
              queryResult.context = context;
              queryResult.value = value;
              if (value) {
                const data = atob(value.data[0]);
                const bytes = Uint8Array.from([...data], (c) =>
                  c.charCodeAt(0)
                );
                queryResult.value.data = bytes;
              }
              queryResult.updatedAt = Date.now();
              console.log("UPDATED", queryResult);
            }
          }
        }
      } else if (req.method === "accountSubscribe") {
        const [pubkey] = req.params;
        const prevData = accountStore.get(pubkey);
        prevData.wsSubscriptionId = res.result;
        prevData.updatedAt = Date.now();
      }
      console.log([...accountStore]);
    };
  }
  const pubkey = solana.publicKey;
  if (pubkey && connectingState !== 2) {
    userPubkey = fromBase58(pubkey.toString());
    connectingState = 2;
  }
  if (connectingState === 0) {
    connectingState = 1;
    solana?.connect?.().then(() => {
      userPubkey = fromBase58(solana.publicKey.toString());
      connectingState = 2;
    });
  }
  return userPubkey;
};
solana?.on("accountChanged", () => {
  turboSolUser();
});

const accountStore = new Map();
let fetchTimer = null;
window.turboSolGetAccount = (pubkey) => {
  if (!ws) turboSolUser();
  if (!accountStore.has(pubkey)) {
    const queryResult = {
      context: { slot: null },
      status: 0, // 0 - idle, 1 - pending, 2 - done
      error: null,
      value: null,
      updatedAt: Date.now(),
      wsSubscriptionId: null,
    };
    accountStore.set(pubkey, queryResult);
    if (!fetchTimer) {
      const timer = setTimeout(async () => {
        if (fetchTimer === timer) fetchTimer = null;
        const unfetchedAccounts = [];
        for (const [pubkey, queryResult] of accountStore) {
          if (queryResult.status === 0) {
            unfetchedAccounts.push(pubkey);
            queryResult.status = 1;
          }
        }
        const res = await fetch(HTTP_RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getMultipleAccounts",
            params: [unfetchedAccounts, { encoding: "base64" }],
          }),
        });
        const json = await res.json();
        if ("error" in json) {
          for (const pubkey of unfetchedAccounts) {
            const prevData = accountStore.get(pubkey);
            prevData.status = 2;
            prevData.error = json.error?.message ?? "Failed to fetch account";
            prevData.updatedAt = Date.now();
          }
        } else {
          const { context, value } = json.result;
          let i = 0;
          for (const accountInfo of value) {
            const pubkey = unfetchedAccounts[i];
            const prevData = accountStore.get(pubkey);
            prevData.status = 2;
            prevData.error = null;
            prevData.context = context;
            queryResult.value = accountInfo;
            if (accountInfo) {
              const data = atob(accountInfo.data[0]);
              const bytes = Uint8Array.from([...data], (c) => c.charCodeAt(0));
              queryResult.value.data = bytes;
            }
            prevData.updatedAt = Date.now();
            const id = crypto.randomUUID();
            const req = {
              jsonrpc: "2.0",
              method: "accountSubscribe",
              id: id,
              params: [pubkey, { commitment: "processed", encoding: "base64" }],
            };
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(req));
            } else {
              wsRequestQueue.push(JSON.stringify(req));
            }
            webSocketRequests.set(id, req);
            i += 1;
          }
        }
        console.log([...accountStore]);
      });
      fetchTimer = timer;
    }
  }
  return accountStore.get(pubkey);
};

window.turboSolSignAndSendTransaction = async (bytes) => {
  const msg = web3.VersionedMessage.deserialize(bytes);
  const response = await fetch(HTTP_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getRecentBlockhash",
    }),
  });
  const recentBlockhash = (await response.json()).result?.value?.blockhash;
  msg.recentBlockhash = recentBlockhash;
  console.log(msg);
  const tx = new web3.VersionedTransaction(msg);
  console.log(tx);
  const res = await solana.signAndSendTransaction(tx);
  console.log(res);
};
