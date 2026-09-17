// lab 7 — temporal commercial network visualization

const width = 760;
const height = 700;

const svg = d3.select("#visualization")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%")
    .style("display", "block");

let companies = [];
let transactions = [];
let currentDay = 1;
let timer = null;


// Network groups

const linksGroup = svg.append("g")
    .attr("class", "links");

const nodesGroup = svg.append("g")
    .attr("class", "nodes");

const labelsGroup = svg.append("g")
    .attr("class", "labels");

const summaryGroup = svg.append("g")
    .attr("class", "network-summary-group")
    .attr("transform", "translate(30, 32)");

const dateLabel = svg.append("text")
    .attr("class", "network-date")
    .attr("x", width - 30)
    .attr("y", 32)
    .attr("text-anchor", "end");


// Tooltip

const tooltip = d3.select("#tooltip");


// Scales

const sectorColors = d3.scaleOrdinal()
    .range(d3.schemeTableau10);

const regionSymbols = d3.scaleOrdinal()
    .range([
        d3.symbolCircle,
        d3.symbolSquare,
        d3.symbolTriangle,
        d3.symbolDiamond,
        d3.symbolStar,
        d3.symbolWye
    ]);

const nodeSizeScale = d3.scaleSqrt()
    .range([7, 27]);

const linkWidthScale = d3.scaleLinear()
    .range([2.5, 8]);

const linkOpacityScale = d3.scaleLinear()
    .range([0.55, 0.95]);


// Force simulation

const simulation = d3.forceSimulation()
    .force(
        "link",
        d3.forceLink()
            .id(d => d.id)
            .distance(125)
            .strength(0.35)
    )
    .force(
        "charge",
        d3.forceManyBody()
            .strength(-250)
    )
    .force(
        "center",
        d3.forceCenter(
            width / 2,
            height / 2 + 20
        )
    )
    .force(
        "x",
        d3.forceX(
            width / 2
        )
        .strength(0.04)
    )
    .force(
        "y",
        d3.forceY(
            height / 2 + 20
        )
        .strength(0.04)
    )
    .force(
        "collision",
        d3.forceCollide()
            .radius(38)
    )
    .on(
        "tick",
        ticked
    );


// Keep nodes inside the network

function keepInside(d) {

    const radius = 32;

    d.x = Math.max(
        45 + radius,
        Math.min(
            width - 45 - radius,
            d.x
        )
    );

    d.y = Math.max(
        80 + radius,
        Math.min(
            height - 55 - radius,
            d.y
        )
    );
}


// Update positions

function ticked() {

    companies.forEach(
        keepInside
    );

    linksGroup
        .selectAll(".network-link")
        .attr(
            "x1",
            d => d.source.x
        )
        .attr(
            "y1",
            d => d.source.y
        )
        .attr(
            "x2",
            d => d.target.x
        )
        .attr(
            "y2",
            d => d.target.y
        );

    nodesGroup
        .selectAll(".network-node")
        .attr(
            "transform",
            d =>
                `translate(${d.x},${d.y})`
        );

    labelsGroup
        .selectAll(".node-label")
        .attr(
            "transform",
            d =>
                `translate(${d.x},${d.y + 40})`
        );
}


// Calculate transaction volume

function companyVolume(
    companyId,
    currentTransactions
) {

    return d3.sum(
        currentTransactions.filter(
            d =>
                d.source === companyId ||
                d.target === companyId
        ),
        d => d.amount_usd
    );
}


// Create an undirected link key

function linkKey(d) {

    const source =
        typeof d.source === "object"
            ? d.source.id
            : d.source;

    const target =
        typeof d.target === "object"
            ? d.target.id
            : d.target;

    return [
        source,
        target
    ]
        .sort()
        .join("-");
}


// Combine transactions between companies

function aggregateLinks(
    currentTransactions
) {

    const grouped = d3.rollup(
        currentTransactions,

        values => ({
            source:
                values[0].source,

            target:
                values[0].target,

            amount_usd:
                d3.sum(
                    values,
                    d => d.amount_usd
                ),

            transaction_count:
                d3.sum(
                    values,
                    d => d.transaction_count
                ),

            transaction_types: [
                ...new Set(
                    values.map(
                        d =>
                            d.transaction_type
                    )
                )
            ]
        }),

        d => linkKey(d)
    );

    return Array.from(
        grouped.values()
    );
}


// Find company

function getCompany(id) {

    return companies.find(
        d => d.id === id
    );
}


// Tooltip

function showTooltip(
    event,
    html
) {

    tooltip
        .html(html)
        .style(
            "left",
            `${event.clientX + 12}px`
        )
        .style(
            "top",
            `${event.clientY + 12}px`
        )
        .style(
            "opacity",
            1
        );
}


function moveTooltip(event) {

    tooltip
        .style(
            "left",
            `${event.clientX + 12}px`
        )
        .style(
            "top",
            `${event.clientY + 12}px`
        );
}


function hideTooltip() {

    tooltip.style(
        "opacity",
        0
    );
}


// Highlight company connections

function highlightConnections(
    companyId
) {

    linksGroup
        .selectAll(".network-link")
        .style(
            "opacity",
            d => {

                const source =
                    typeof d.source === "object"
                        ? d.source.id
                        : d.source;

                const target =
                    typeof d.target === "object"
                        ? d.target.id
                        : d.target;

                if (
                    source === companyId ||
                    target === companyId
                ) {
                    return 1;
                }

                return 0.12;
            }
        );

    nodesGroup
        .selectAll(".network-node")
        .style(
            "opacity",
            d => {

                if (
                    d.id === companyId
                ) {
                    return 1;
                }

                const connected =
                    linksGroup
                        .selectAll(
                            ".network-link"
                        )
                        .filter(
                            link => {

                                const source =
                                    typeof link.source === "object"
                                        ? link.source.id
                                        : link.source;

                                const target =
                                    typeof link.target === "object"
                                        ? link.target.id
                                        : link.target;

                                return (
                                    source === companyId &&
                                    target === d.id
                                ) || (
                                    target === companyId &&
                                    source === d.id
                                );
                            }
                        )
                        .size() > 0;

                return connected
                    ? 1
                    : 0.3;
            }
        );
}


// Restore normal appearance

function resetHighlight() {

    linksGroup
        .selectAll(".network-link")
        .style(
            "opacity",
            d =>
                linkOpacityScale(
                    d.transaction_count
                )
        );

    nodesGroup
        .selectAll(".network-node")
        .style(
            "opacity",
            d => {

                const volume =
                    companyVolume(
                        d.id,
                        transactions.filter(
                            t =>
                                t.day === currentDay
                        )
                    );

                return volume > 0
                    ? 1
                    : 0.35;
            }
        );
}


// Update summary

function updateSummary(
    currentTransactions
) {

    const activeCompanies =
        new Set();

    currentTransactions.forEach(
        d => {

            activeCompanies.add(
                d.source
            );

            activeCompanies.add(
                d.target
            );
        }
    );

    const currentLinks =
        aggregateLinks(
            currentTransactions
        );

    const totalValue =
        d3.sum(
            currentTransactions,
            d => d.amount_usd
        );

    summaryGroup
        .selectAll("*")
        .remove();

    summaryGroup
        .append("text")
        .attr(
            "class",
            "network-summary"
        )
        .text(
            `Active companies: ${activeCompanies.size}`
        );

    summaryGroup
        .append("text")
        .attr(
            "class",
            "network-summary"
        )
        .attr(
            "y",
            19
        )
        .text(
            `Active links: ${currentLinks.length}`
        );

    summaryGroup
        .append("text")
        .attr(
            "class",
            "network-summary"
        )
        .attr(
            "y",
            38
        )
        .text(
            `Total transaction value: $${d3.format(",.0f")(totalValue)}`
        );
}


// Dragging

function dragStarted(
    event,
    d
) {

    if (!event.active) {

        simulation
            .alphaTarget(0.2)
            .restart();

    }

    d.fx = d.x;
    d.fy = d.y;
}


function dragged(
    event,
    d
) {

    d.fx = event.x;
    d.fy = event.y;

    keepInside(d);
}


function dragEnded(
    event,
    d
) {

    if (!event.active) {
        simulation.alphaTarget(0);
    }

    d.fx = null;
    d.fy = null;
}


// Update network

function updateNetwork(
    currentTransactions
) {

    const currentLinks =
        aggregateLinks(
            currentTransactions
        );


    const volumes =
        companies.map(
            company =>
                companyVolume(
                    company.id,
                    currentTransactions
                )
        );


    const maxVolume =
        d3.max(volumes) || 1;

    nodeSizeScale.domain([
        0,
        maxVolume
    ]);


    const maxAmount =
        d3.max(
            currentLinks,
            d => d.amount_usd
        ) || 1;

    linkWidthScale.domain([
        0,
        maxAmount
    ]);


    const maxCount =
        d3.max(
            currentLinks,
            d => d.transaction_count
        ) || 1;

    linkOpacityScale.domain([
        0,
        maxCount
    ]);


    const simulationLinks =
        currentLinks.map(
            d => ({
                source: d.source,
                target: d.target,
                amount_usd:
                    d.amount_usd,
                transaction_count:
                    d.transaction_count,
                transaction_types:
                    d.transaction_types
            })
        );


    // Links

    const linkSelection =
        linksGroup
            .selectAll(
                ".network-link"
            )
            .data(
                simulationLinks,
                d => linkKey(d)
            );


    linkSelection
        .exit()
        .transition()
        .duration(500)
        .style(
            "opacity",
            0
        )
        .remove();


    const linkEnter =
        linkSelection
            .enter()
            .append("line")
            .attr(
                "class",
                "network-link"
            )
            .attr(
                "stroke",
                "#555555"
            )
            .attr(
                "stroke-linecap",
                "round"
            )
            .style(
                "opacity",
                0
            )

            .on(
                "mouseover",
                function(event, d) {

                    const sourceId =
                        typeof d.source === "object"
                            ? d.source.id
                            : d.source;

                    const targetId =
                        typeof d.target === "object"
                            ? d.target.id
                            : d.target;

                    const source =
                        getCompany(sourceId);

                    const target =
                        getCompany(targetId);


                    d3.select(this)
                        .style(
                            "stroke",
                            "#111111"
                        )
                        .style(
                            "opacity",
                            1
                        )
                        .style(
                            "stroke-width",
                            Math.max(
                                4,
                                linkWidthScale(
                                    d.amount_usd
                                )
                            )
                        );


                    showTooltip(
                        event,
                        `
                        <div class="tooltip-country">
                            ${
                                source
                                    ? source.company_name
                                    : sourceId
                            }
                            ↔
                            ${
                                target
                                    ? target.company_name
                                    : targetId
                            }
                        </div>

                        <div>
                            <span class="tooltip-label">
                                Transaction type:
                            </span>
                            ${d.transaction_types.join(", ")}
                        </div>

                        <div>
                            <span class="tooltip-label">
                                Transaction amount:
                            </span>
                            $${d3.format(",.2f")(
                                d.amount_usd
                            )}
                        </div>

                        <div>
                            <span class="tooltip-label">
                                Transaction count:
                            </span>
                            ${d3.format(",")(
                                d.transaction_count
                            )}
                        </div>
                        `
                    );
                }
            )

            .on(
                "mousemove",
                moveTooltip
            )

            .on(
                "mouseout",
                function(event, d) {

                    d3.select(this)
                        .style(
                            "stroke",
                            "#555555"
                        )
                        .style(
                            "stroke-width",
                            linkWidthScale(
                                d.amount_usd
                            )
                        )
                        .style(
                            "opacity",
                            linkOpacityScale(
                                d.transaction_count
                            )
                        );

                    hideTooltip();
                }
            );


    linkEnter
        .merge(linkSelection)
        .transition()
        .duration(500)
        .attr(
            "stroke-width",
            d =>
                linkWidthScale(
                    d.amount_usd
                )
        )
        .style(
            "opacity",
            d =>
                linkOpacityScale(
                    d.transaction_count
                )
        );


    // Nodes

    const nodeSelection =
        nodesGroup
            .selectAll(
                ".network-node"
            )
            .data(
                companies,
                d => d.id
            );


    const nodeEnter =
        nodeSelection
            .enter()
            .append("g")
            .attr(
                "class",
                "network-node"
            )
            .call(
                d3.drag()
                    .on(
                        "start",
                        dragStarted
                    )
                    .on(
                        "drag",
                        dragged
                    )
                    .on(
                        "end",
                        dragEnded
                    )
            )

            .on(
                "mouseover",
                function(event, d) {

                    highlightConnections(
                        d.id
                    );


                    const volume =
                        companyVolume(
                            d.id,
                            currentTransactions
                        );


                    showTooltip(
                        event,
                        `
                        <div class="tooltip-country">
                            ${d.company_name}
                        </div>

                        <div>
                            <span class="tooltip-label">
                                Company ID:
                            </span>
                            ${d.id}
                        </div>

                        <div>
                            <span class="tooltip-label">
                                Sector:
                            </span>
                            ${d.sector}
                        </div>

                        <div>
                            <span class="tooltip-label">
                                Region:
                            </span>
                            ${d.region}
                        </div>

                        <div>
                            <span class="tooltip-label">
                                Current transaction volume:
                            </span>
                            $${d3.format(",.2f")(
                                volume
                            )}
                        </div>
                        `
                    );
                }
            )

            .on(
                "mousemove",
                moveTooltip
            )

            .on(
                "mouseout",
                function() {

                    resetHighlight();

                    hideTooltip();
                }
            );


    nodeEnter
        .append("path");


    nodeSelection
        .merge(nodeEnter)
        .style(
            "opacity",
            d => {

                const volume =
                    companyVolume(
                        d.id,
                        currentTransactions
                    );

                return volume > 0
                    ? 1
                    : 0.35;
            }
        )
        .select("path")
        .transition()
        .duration(500)
        .attr(
            "d",
            d => {

                const volume =
                    companyVolume(
                        d.id,
                        currentTransactions
                    );

                const radius =
                    nodeSizeScale(
                        volume
                    );

                return d3.symbol()
                    .type(
                        regionSymbols(
                            d.region
                        )
                    )
                    .size(
                        Math.PI *
                        radius *
                        radius
                    )();
            }
        )
        .attr(
            "fill",
            d =>
                sectorColors(
                    d.sector
                )
        )
        .attr(
            "stroke",
            "#333333"
        )
        .attr(
            "stroke-width",
            1.2
        );


    // Labels

    const labelSelection =
        labelsGroup
            .selectAll(
                ".node-label"
            )
            .data(
                companies,
                d => d.id
            );


    labelSelection
        .enter()
        .append("text")
        .attr(
            "class",
            "node-label"
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            d =>
                d.company_name
        );


    labelSelection
        .exit()
        .remove();


    // Restart simulation

    simulation.nodes(
        companies
    );

    simulation
        .force("link")
        .links(
            simulationLinks
        );

    simulation
        .alpha(0.12)
        .restart();


    updateSummary(
        currentTransactions
    );
}


// Get date for day

function getDateForDay(day) {

    if (!transactions.length) {
        return null;
    }

    const firstDate =
        d3.min(
            transactions,
            d => d.date
        );

    return d3.timeDay.offset(
        firstDate,
        day - 1
    );
}


// Get day from date

function getDayForDate(
    dateString
) {

    const selectedDate =
        d3.timeParse(
            "%Y-%m-%d"
        )(dateString);

    if (
        !selectedDate ||
        !transactions.length
    ) {
        return null;
    }

    const firstDate =
        d3.min(
            transactions,
            d => d.date
        );

    const difference =
        d3.timeDay.count(
            firstDate,
            selectedDate
        );

    const day =
        difference + 1;

    if (
        day < 1 ||
        day > 60
    ) {
        return null;
    }

    return day;
}


// Update temporal controls

function updateDateControls() {

    const currentDate =
        getDateForDay(
            currentDay
        );

    if (!currentDate) {
        return;
    }


    const dateValue =
        d3.timeFormat(
            "%Y-%m-%d"
        )(currentDate);


    const formattedDate =
        d3.timeFormat(
            "%B %d, %Y"
        )(currentDate);


    d3.select("#time-slider")
        .property(
            "value",
            currentDay
        );


    d3.select("#date-picker")
        .property(
            "value",
            dateValue
        );


    d3.select("#current-day")
        .text(
            `Day ${currentDay}: ${formattedDate}`
        );


    dateLabel
        .text(
            formattedDate
        );
}


// Show selected day

function showDay(day) {

    currentDay =
        Math.max(
            1,
            Math.min(
                60,
                +day
            )
        );


    const currentTransactions =
        transactions.filter(
            d =>
                d.day === currentDay
        );


    updateDateControls();

    updateNetwork(
        currentTransactions
    );
}


// Play

function play() {

    if (timer !== null) {
        return;
    }


    if (currentDay >= 60) {
        showDay(1);
    }


    timer = d3.interval(
        () => {

            if (currentDay >= 60) {

                pause();

                return;
            }

            showDay(
                currentDay + 1
            );

        },
        700
    );
}


// Pause

function pause() {

    if (timer !== null) {

        timer.stop();

        timer = null;
    }
}


// Reset

function reset() {

    pause();

    showDay(1);
}


// Create legend

function createLegend() {

    const legend =
        d3.select("#legend");

    legend
        .selectAll("*")
        .remove();


    legend
        .append("p")
        .attr(
            "class",
            "lab7-legend-title"
        )
        .text(
            "Company sector:"
        );


    const sectors = [
        ...new Set(
            companies.map(
                d => d.sector
            )
        )
    ];


    sectors.forEach(
        sector => {

            const item =
                legend
                    .append("div")
                    .attr(
                        "class",
                        "lab7-legend-item"
                    );


            item
                .append("svg")
                .attr(
                    "class",
                    "lab7-legend-symbol"
                )
                .attr(
                    "width",
                    18
                )
                .attr(
                    "height",
                    18
                )
                .append("circle")
                .attr(
                    "cx",
                    9
                )
                .attr(
                    "cy",
                    9
                )
                .attr(
                    "r",
                    6
                )
                .attr(
                    "fill",
                    sectorColors(
                        sector
                    )
                )
                .attr(
                    "stroke",
                    "#333333"
                );


            item
                .append("span")
                .text(
                    sector
                );
        }
    );


    legend
        .append("p")
        .attr(
            "class",
            "lab7-legend-title"
        )
        .text(
            "Encodings:"
        );


    legend
        .append("p")
        .text(
            "Node shape → geographic region."
        );


    legend
        .append("p")
        .text(
            "Node size → current transaction volume."
        );


    legend
        .append("p")
        .text(
            "Link width → transaction amount."
        );


    legend
        .append("p")
        .text(
            "Link opacity → transaction count."
        );


    legend
        .append("p")
        .text(
            "Links are undirected and represent active commercial relationships."
        );
}


// Load data

Promise.all([

    d3.csv(
        "../data/lab7_assignment_companies.csv",
        d => ({
            id:
                d.id,

            company_name:
                d.company_name,

            sector:
                d.sector,

            region:
                d.region
        })
    ),

    d3.csv(
        "../data/lab7_assignment_transactions_60days.csv",
        d => ({
            date:
                d3.timeParse(
                    "%Y-%m-%d"
                )(d.date),

            day:
                +d.day,

            source:
                d.source,

            target:
                d.target,

            amount_usd:
                +d.amount_usd,

            transaction_type:
                d.transaction_type,

            transaction_count:
                +d.transaction_count
        })
    )

])

.then(
    ([companyData, transactionData]) => {

        companies =
            companyData;

        transactions =
            transactionData.filter(
                d =>
                    d.date &&
                    d.day >= 1 &&
                    d.day <= 60 &&
                    d.source &&
                    d.target &&
                    Number.isFinite(
                        d.amount_usd
                    ) &&
                    Number.isFinite(
                        d.transaction_count
                    )
            );


        const sectors = [
            ...new Set(
                companies.map(
                    d => d.sector
                )
            )
        ];


        const regions = [
            ...new Set(
                companies.map(
                    d => d.region
                )
            )
        ];


        sectorColors.domain(
            sectors
        );

        regionSymbols.domain(
            regions
        );


        // Initial node positions

        companies.forEach(
            (d, i) => {

                const angle =
                    (
                        i /
                        companies.length
                    ) *
                    Math.PI *
                    2;

                const radius = 250;

                d.x =
                    width / 2 +
                    Math.cos(angle) *
                    radius;

                d.y =
                    height / 2 +
                    Math.sin(angle) *
                    radius;

                keepInside(d);
            }
        );


        // Date picker limits

        const firstDate =
            d3.min(
                transactions,
                d => d.date
            );

        const lastDate =
            d3.max(
                transactions,
                d => d.date
            );


        if (firstDate) {

            d3.select("#date-picker")
                .attr(
                    "min",
                    d3.timeFormat(
                        "%Y-%m-%d"
                    )(firstDate)
                );
        }


        if (lastDate) {

            d3.select("#date-picker")
                .attr(
                    "max",
                    d3.timeFormat(
                        "%Y-%m-%d"
                    )(lastDate)
                );
        }


        createLegend();

        showDay(1);
    }
)

.catch(
    error => {

        console.error(
            "Error loading Lab 7 data:",
            error
        );

        d3.select("#visualization")
            .html(`
                <div class="error-message">
                    Unable to load the Lab 7 data.
                    <br>
                    ${error.message}
                </div>
            `);
    }
);


// Temporal controls

d3.select("#play")
    .on(
        "click",
        play
    );


d3.select("#pause")
    .on(
        "click",
        pause
    );


d3.select("#reset")
    .on(
        "click",
        reset
    );


d3.select("#time-slider")
    .on(
        "input",
        function() {

            pause();

            showDay(
                +this.value
            );
        }
    );


d3.select("#date-picker")
    .on(
        "change",
        function() {

            const selectedDay =
                getDayForDate(
                    this.value
                );

            if (
                selectedDay !== null
            ) {

                pause();

                showDay(
                    selectedDay
                );
            }
        }
    );