import { initBotId } from "botid/client/core";

initBotId({
  protect: [{ path: "/api/extract", method: "POST", advancedOptions: { checkLevel: "basic" } }],
});
