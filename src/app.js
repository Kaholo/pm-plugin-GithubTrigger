const { verifyRepoName, verifySignature, isMatch } = require("./helpers");

async function webhookPush(req, res, settings, triggerControllers) {
    try {
        const body = req.body;
        let [_temp, pushType, ...pushName] = req.body.ref.split("/");
        // fix push name in case it contains /
        if (Array.isArray(pushName)) pushName = pushName.join("/");
        // get the push type
        if (pushType === "heads") pushType = "branch";
        else if (pushType === "tags") pushType = "tag";
        else {
            return res.status(400).send("Bad Push Type");
        }
        const reqRepoName = body.repository.name; //Github repository name
        const reqSecret = req.headers["x-hub-signature-256"];
        const paramName = `${pushType}Pat`;

        triggerControllers.forEach((trigger) => {
            if (!verifyRepoName(trigger, reqRepoName) || !verifySignature(trigger, reqSecret, body)) return;
            if (trigger.params.tagPat || trigger.params.branchPat){ // If both weren't provided, don't filter by push name
                const validateParam = trigger.params[paramName];
                if (!validateParam || !isMatch(pushName, validateParam)) return;
            }
            const msg = `Github ${reqRepoName} ${pushName} ${pushType} Push`;
            trigger.execute(msg, body);
        });
        res.status(200).send("OK");
    }
    catch (err){
        res.status(422).send(err.toString());
    }
}

async function webhookPR(req, res, settings, triggerControllers) {
    try {
        const body = req.body;
        const reqRepoName = body.repository.name; //Github repository name
        const reqSecret = req.headers["x-hub-signature-256"]
        const reqTargetBranch = body.pull_request.base.ref; //Get target branch name
        const reqSourceBranch = body.pull_request.head.ref; //Get source branch name
        const merged = body.pull_request.merged;
        const reqActionType =  body.action === "closed" ? (merged ? "merged" : "declined") : body.action;
    
        triggerControllers.forEach((trigger) => {
            if (!verifyRepoName(trigger, reqRepoName) || !verifySignature(trigger, reqSecret, body)) return;
            const {toBranch, fromBranch, actionType} = trigger.params;
            if (!isMatch(reqTargetBranch, toBranch)) return;
            // Check that From branch provided is same as request. If not provided consider as any.
            if (!isMatch(reqSourceBranch, fromBranch)) return;
            // Check that action type provided is same as request. If not provided consider as any.
            if (actionType && actionType !== "any" && triggerActionType !== reqActionType) return;
            const msg = `Github ${reqRepoName} ${reqSourceBranch}->${reqTargetBranch} PR ${reqActionType}`
            trigger.execute(msg, body);
        });
        res.status(200).send("OK");
    }
    catch (err){
        res.status(422).send(err.message);
    }
}

module.exports = {
    webhookPush,
    webhookPR
}