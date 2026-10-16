(() => {
    const startButton = document.querySelector("#voice-button");
    const stopButton = document.querySelector("#voice-stop");
    const clearButton = document.querySelector("#voice-clear");
    const statusOutput = document.querySelector("#voice-status");
    const heardOutput = document.querySelector("#voice-heard");
    const actionOutput = document.querySelector("#voice-action");

    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    let recognition = null;
    let shouldListen = false;
    let activeRegion = null;
    let activeCompanyId = null;

    function setStatus(message) {
        statusOutput.textContent = message;
    }

    function setHeard(message) {
        heardOutput.textContent = `Heard: ${message || "—"}`;
    }

    function setAction(message) {
        actionOutput.textContent = `Action: ${message}`;
    }

    function normalizeText(value) {
        return String(value || "")
            .toLocaleLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function getCompanies() {
        return typeof companies !== "undefined" && Array.isArray(companies)
            ? companies
            : [];
    }

    function getRegions() {
        return [
            ...new Set(
                getCompanies()
                    .map(company => company.region)
                    .filter(Boolean)
            )
        ];
    }

    function findCompanyFromPhrase(phrase) {
        const normalizedPhrase = normalizeText(phrase);
        const companyList = getCompanies();

        if (!normalizedPhrase || !companyList.length) {
            return null;
        }

        const exact = companyList.filter(
            company =>
                normalizeText(company.company_name) === normalizedPhrase
        );

        if (exact.length === 1) {
            return exact[0];
        }

        const partial = companyList.filter(company => {
            const name = normalizeText(company.company_name);

            return name && (
                normalizedPhrase.includes(name) ||
                name.includes(normalizedPhrase)
            );
        });

        return partial.length === 1 ? partial[0] : null;
    }

    function endpointId(endpoint) {
        return endpoint && typeof endpoint === "object"
            ? endpoint.id
            : endpoint;
    }

    function currentLinks() {
        if (typeof linksGroup === "undefined") {
            return [];
        }

        return linksGroup.selectAll(".network-link").data();
    }

    function applyVoiceState() {
        if (typeof resetHighlight === "function") {
            resetHighlight();
        }

        if (
            typeof d3 === "undefined" ||
            typeof nodesGroup === "undefined" ||
            typeof linksGroup === "undefined" ||
            typeof labelsGroup === "undefined"
        ) {
            return;
        }

        const companyList = getCompanies();

        const companyById = new Map(
            companyList.map(company => [
                String(company.id),
                company
            ])
        );

        const regionKey = activeRegion
            ? normalizeText(activeRegion)
            : null;

        const selectedId = activeCompanyId == null
            ? null
            : String(activeCompanyId);

        const neighborIds = new Set();

        if (selectedId !== null) {
            currentLinks().forEach(link => {
                const source = String(endpointId(link.source));
                const target = String(endpointId(link.target));

                if (source === selectedId) {
                    neighborIds.add(target);
                }

                if (target === selectedId) {
                    neighborIds.add(source);
                }
            });
        }

        linksGroup.selectAll(".network-link")
            .interrupt()
            .style("opacity", link => {
                const sourceId = String(endpointId(link.source));
                const targetId = String(endpointId(link.target));

                const sourceCompany = companyById.get(sourceId);
                const targetCompany = companyById.get(targetId);

                const touchesRegion = regionKey !== null && (
                    normalizeText(sourceCompany?.region) === regionKey ||
                    normalizeText(targetCompany?.region) === regionKey
                );

                const touchesSelected = selectedId !== null && (
                    sourceId === selectedId ||
                    targetId === selectedId
                );

                if (regionKey === null && selectedId === null) {
                    return typeof transactionCountOpacity === "function"
                        ? transactionCountOpacity(link.transaction_count)
                        : 0.6;
                }

                return touchesSelected || touchesRegion ? 0.95 : 0.08;
            })
            .attr("stroke", link => {
                const sourceId = String(endpointId(link.source));
                const targetId = String(endpointId(link.target));

                return selectedId !== null && (
                    sourceId === selectedId ||
                    targetId === selectedId
                )
                    ? "#0f766e"
                    : "#555555";
            });

        nodesGroup.selectAll(".network-node")
            .interrupt()
            .style("opacity", company => {
                const id = String(company.id);

                const isSelected =
                    selectedId !== null && id === selectedId;

                const isNeighbor =
                    selectedId !== null && neighborIds.has(id);

                const isInRegion =
                    regionKey !== null &&
                    normalizeText(company.region) === regionKey;

                if (regionKey === null && selectedId === null) {
                    const volume = typeof companyVolume === "function"
                        ? companyVolume(
                            company.id,
                            currentDayTransactions
                        )
                        : 0;

                    return volume > 0 ? 1 : 0.35;
                }

                return isSelected || isNeighbor || isInRegion ? 1 : 0.16;
            })
            .select("path")
            .attr("stroke", company =>
                selectedId !== null &&
                String(company.id) === selectedId
                    ? "#0f766e"
                    : "#333333"
            )
            .attr("stroke-width", company =>
                selectedId !== null &&
                String(company.id) === selectedId
                    ? 3
                    : 1.2
            );

        labelsGroup.selectAll(".node-label")
            .interrupt()
            .style("opacity", company => {
                const id = String(company.id);

                const isSelected =
                    selectedId !== null && id === selectedId;

                const isNeighbor =
                    selectedId !== null && neighborIds.has(id);

                const isInRegion =
                    regionKey !== null &&
                    normalizeText(company.region) === regionKey;

                if (regionKey === null && selectedId === null) {
                    return 1;
                }

                return isSelected || isNeighbor || isInRegion ? 1 : 0.18;
            })
            .style("font-weight", company =>
                selectedId !== null &&
                String(company.id) === selectedId
                    ? "700"
                    : "400"
            );
    }

    // The copied visualization can call this after each timeline update.
    window.applyVoiceState = applyVoiceState;

    function clearVoiceEmphasis() {
        activeRegion = null;
        activeCompanyId = null;

        applyVoiceState();

        setAction("Cleared the company highlight and region emphasis.");
    }

    window.clearVoiceEmphasis = clearVoiceEmphasis;

    function startListening() {
        if (!SpeechRecognition) {
            shouldListen = false;
            startButton.disabled = false;
            stopButton.disabled = true;

            setStatus(
                "Voice recognition is not supported by this browser. " +
                "Use the manual controls below."
            );

            setAction(
                "No voice action was taken; manual controls remain available."
            );

            return;
        }

        if (shouldListen) {
            setStatus(
                "Voice control is already listening. Speak a command " +
                "or click Stop Listening."
            );
            return;
        }

        if (!recognition) {
            createRecognition();
        }

        shouldListen = true;
        startButton.disabled = true;
        stopButton.disabled = false;

        setStatus(
            "Requesting microphone access and starting voice recognition…"
        );

        try {
            recognition.start();
        } catch (error) {
            if (error.name === "InvalidStateError") {
                setStatus(
                    "Voice recognition is starting. Please wait a moment " +
                    "before trying again."
                );
            } else {
                shouldListen = false;
                startButton.disabled = false;
                stopButton.disabled = true;

                setStatus(
                    "Could not start voice recognition. Check browser " +
                    "permissions and use the manual controls if needed."
                );
            }
        }
    }

    function stopListening(
        message = "Voice control stopped. The manual controls remain available."
    ) {
        shouldListen = false;
        startButton.disabled = false;
        stopButton.disabled = true;

        setStatus(message);

        if (recognition) {
            try {
                recognition.stop();
            } catch (error) {
                // Recognition may already have stopped.
            }
        }
    }

    function createRecognition() {
        recognition = new SpeechRecognition();

        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            if (shouldListen) {
                setStatus("Listening. Speak one command at a time.");
            }
        };

        recognition.onresult = event => {
            let interimTranscript = "";
            const finalCommands = [];

            for (
                let i = event.resultIndex;
                i < event.results.length;
                i += 1
            ) {
                const transcript =
                    event.results[i][0].transcript.trim();

                if (event.results[i].isFinal) {
                    if (transcript) {
                        finalCommands.push(transcript);
                    }
                } else {
                    interimTranscript += `${transcript} `;
                }
            }

            if (finalCommands.length) {
                finalCommands.forEach(transcript => {
                    setHeard(`“${transcript}”`);
                    executeCommand(transcript);
                });
            } else if (interimTranscript.trim()) {
                setHeard(
                    `Listening: “${interimTranscript.trim()}…”`
                );
            }
        };

        recognition.onerror = event => {
            const errors = {
                "not-allowed":
                    "Microphone permission was denied. Allow access in " +
                    "your browser settings or use the manual controls.",

                "service-not-allowed":
                    "The browser's speech-recognition service is " +
                    "unavailable or blocked.",

                "audio-capture":
                    "No usable microphone was found. Connect a microphone " +
                    "or use the manual controls.",

                "network":
                    "The speech-recognition service reported a network " +
                    "error. Try again or use the manual controls.",

                "no-speech":
                    "No speech was detected. Speak clearly, or use the " +
                    "manual controls.",

                "language-not-supported":
                    "The selected recognition language is unavailable " +
                    "in this browser."
            };

            const message = errors[event.error] ||
                `Voice recognition error: ${event.error}.`;

            setStatus(message);

            if ([
                "not-allowed",
                "service-not-allowed",
                "audio-capture",
                "language-not-supported"
            ].includes(event.error)) {
                shouldListen = false;
                startButton.disabled = false;
                stopButton.disabled = true;
            }
        };

        recognition.onend = () => {
            if (!shouldListen) {
                startButton.disabled = false;
                stopButton.disabled = true;
                return;
            }

            window.setTimeout(() => {
                if (!shouldListen || !recognition) {
                    return;
                }

                try {
                    recognition.start();
                } catch (error) {
                    if (error.name !== "InvalidStateError") {
                        shouldListen = false;
                        startButton.disabled = false;
                        stopButton.disabled = true;

                        setStatus(
                            "Voice recognition stopped unexpectedly. " +
                            "Click Start to try again or use the manual controls."
                        );
                    }
                }
            }, 250);
        };
    }

    function executeCommand(rawTranscript) {
        const command = normalizeText(rawTranscript);

        if (!command) {
            return false;
        }

        // Help
        if (/^(help|commands|what can i say|list commands)$/.test(command)) {
            setAction(
                "Open the Voice commands and how to use them panel " +
                "for the supported command list."
            );

            const details = document.querySelector(
                ".lab10-voice-panel details"
            );

            if (details) {
                details.open = true;
            }

            return true;
        }

        // Stop listening
        if (/^(stop listening|turn off voice control|disable voice control)$/.test(command)) {
            setAction("Voice listening stopped by command.");
            stopListening("Voice control stopped by voice command.");
            return true;
        }

        // Clear all voice emphasis
        if (/^(clear emphasis|clear all highlights|clear all|remove all highlights)$/.test(command)) {
            clearVoiceEmphasis();
            return true;
        }

        // Clear the company selection only
        if (/^(clear highlight|clear company highlight|clear selection|deselect company)$/.test(command)) {
            activeCompanyId = null;
            applyVoiceState();

            setAction(
                activeRegion
                    ? `Cleared the company highlight. The ${activeRegion} ` +
                      "region emphasis remains active."
                    : "Cleared the company highlight."
            );

            return true;
        }

        // Clear the region selection only
        if (/^(clear region filter|clear filter|show all regions|remove region filter)$/.test(command)) {
            activeRegion = null;
            applyVoiceState();

            setAction(
                activeCompanyId !== null
                    ? "Cleared the region emphasis. The selected company " +
                      "highlight remains active."
                    : "Cleared the region emphasis; all companies are " +
                      "shown at normal emphasis."
            );

            return true;
        }

        // Play animation
        if (/^(play|play animation|start animation|resume animation)$/.test(command)) {
            if (typeof play !== "function") {
                setAction(
                    "The Lab 7 play function was not found. Check that " +
                    "lab10.js loads before voice-interaction.js."
                );
                return false;
            }

            play();
            setAction("Started the timeline animation.");
            return true;
        }

        // Pause animation
        if (/^(pause|pause animation|stop animation)$/.test(command)) {
            pause();
            setAction(`Paused the timeline at Day ${currentDay}.`);
            return true;
        }

        // Reset animation and clear voice emphasis
        if (/^(reset|reset timeline|reset visualization|start over)$/.test(command)) {
            activeRegion = null;
            activeCompanyId = null;

            reset();
            applyVoiceState();

            setAction(
                "Reset the timeline to Day 1 and cleared all voice emphasis."
            );

            return true;
        }

        // Move to the next day
        if (/^(next day|next|advance one day|move forward one day)$/.test(command)) {
            const totalDays = getAvailableDates().length;

            if (currentDay >= totalDays) {
                setAction(`Already at the final day (Day ${totalDays}).`);
                return true;
            }

            pause();
            showDay(currentDay + 1);

            setAction(`Moved to Day ${currentDay}.`);
            return true;
        }

        // Move to the previous day
        if (/^(previous day|prev day|previous|go back one day|move back one day)$/.test(command)) {
            if (currentDay <= 1) {
                setAction("Already at Day 1.");
                return true;
            }

            pause();
            showDay(currentDay - 1);

            setAction(`Moved to Day ${currentDay}.`);
            return true;
        }

        // Jump directly to a requested day
        const dayMatch = command.match(
            /^(?:go to|show|jump to|select)?\s*day\s+(\d{1,2})$/
        );

        if (dayMatch) {
            const requestedDay = Number(dayMatch[1]);
            const totalDays = getAvailableDates().length;

            if (requestedDay < 1 || requestedDay > totalDays) {
                setAction(
                    `Day must be between 1 and ${totalDays}. No change was made.`
                );
                return false;
            }

            pause();
            showDay(requestedDay);

            setAction(`Moved directly to Day ${currentDay}.`);
            return true;
        }

        // Emphasize a region
        const regionPrefix = command.match(
            /^(?:show|filter|emphasize|focus on|highlight region)\s+(.+)$/
        );

        if (regionPrefix) {
            const requestedRegion = normalizeText(regionPrefix[1]);

            const region = getRegions().find(
                item => normalizeText(item) === requestedRegion
            );

            if (region) {
                activeRegion = region;
                applyVoiceState();

                setAction(
                    `Emphasized ${region} companies and relationships ` +
                    "connected to that region."
                );

                return true;
            }
        }

        // Find a company from any supported company command
        const companyPrefixes = [
            /^highlight company\s+(.+)$/,
            /^highlight\s+(.+)$/,
            /^focus on company\s+(.+)$/,
            /^focus on\s+(.+)$/,
            /^focus\s+(.+)$/,
            /^select company\s+(.+)$/,
            /^select\s+(.+)$/,
            /^show connections for\s+(.+)$/,
            /^connections for\s+(.+)$/,
            /^find company\s+(.+)$/,
            /^locate company\s+(.+)$/,
            /^show company\s+(.+)$/
        ];

        for (const pattern of companyPrefixes) {
            const match = command.match(pattern);

            if (!match) {
                continue;
            }

            const company = findCompanyFromPhrase(match[1]);

            if (company) {
                activeCompanyId = company.id;
                applyVoiceState();

                setAction(
                    `Highlighted ${company.company_name} and its active ` +
                    `transaction connections on Day ${currentDay}.`
                );

                return true;
            }

            setAction(
                `I could not uniquely match “${match[1]}” to a company ` +
                "in the loaded dataset. Try the exact company name shown " +
                "in a tooltip."
            );

            return false;
        }

        // Also accept an exact company name spoken by itself
        const standaloneCompany = findCompanyFromPhrase(command);

        if (
            standaloneCompany &&
            normalizeText(standaloneCompany.company_name) === command
        ) {
            activeCompanyId = standaloneCompany.id;
            applyVoiceState();

            setAction(
                `Highlighted ${standaloneCompany.company_name} and its ` +
                `active transaction connections on Day ${currentDay}.`
            );

            return true;
        }

        // Unknown commands are not executed
        setAction(
            `No action taken for “${rawTranscript}”. Try “next day,” ` +
            "“show Europe,” “highlight [company name],” or say “help.”"
        );

        setStatus(
            "Command not recognized. The visualization was not changed; " +
            "try another command or use the manual controls."
        );

        return false;
    }

    startButton.addEventListener("click", startListening);

    stopButton.addEventListener("click", () => {
        stopListening();
    });

    clearButton.addEventListener("click", clearVoiceEmphasis);

    if (!SpeechRecognition) {
        startButton.title =
            "Speech recognition is not supported in this browser";

        setStatus(
            "Voice recognition is not supported by this browser. " +
            "The manual controls remain available."
        );
    }
})();