const width = 900;
const height = 650;

const svg =
    d3.select("#visualization")
        .append("svg")
        .attr(
            "viewBox",
            `0 0 ${width} ${height}`
        )
        .attr(
            "preserveAspectRatio",
            "xMidYMid meet"
        )
        .style(
            "width",
            "100%"
        )
        .style(
            "height",
            "100%"
        )
        .style(
            "display",
            "block"
        );

let companies = [];
let transactions = [];
let currentDay = 1;
let timer = null;

const linksGroup =
    svg.append("g")
        .attr(
            "class",
            "links"
        );

const nodesGroup =
    svg.append("g")
        .attr(
            "class",
            "nodes"
        );

const labelsGroup =
    svg.append("g")
        .attr(
            "class",
            "labels"
        );

const summaryGroup =
    svg.append("g")
        .attr(
            "class",
            "network-summary-group"
        )
        .attr(
            "transform",
            "translate(30, 34)"
        );

const dateLabel =
    svg.append("text")
        .attr(
            "class",
            "network-date"
        )
        .attr(
            "x",
            width - 30
        )
        .attr(
            "y",
            34
        )
        .attr(
            "text-anchor",
            "end"
        );

const tooltip =
    d3.select("#tooltip");

const sectorColors =
    d3.scaleOrdinal()
        .range(
            d3.schemeTableau10
        );

const regionSymbols =
    d3.scaleOrdinal()
        .range([
            d3.symbolCircle,
            d3.symbolSquare,
            d3.symbolTriangle
        ]);

const nodeSizeScale =
    d3.scaleSqrt()
        .range([
            9,
            32
        ]);

const linkWidthScale =
    d3.scaleThreshold()
        .domain([
            10000,
            50000,
            100000
        ])
        .range([
            2.5,
            4,
            6,
            8
        ]);

const transactionPatterns = {
    goods: "0",
    materials: "16 7",
    services: "2 5",
    shipping: "12 5 2 5",
    components: "20 5 3 5 3 5"
};

function getTransactionPattern(d) {
    const types =
        d.transaction_types || [];

    const type =
        types.length
            ? String(
                types[0]
            )
                .toLowerCase()
                .trim()
            : "goods";

    return (
        transactionPatterns[type] ||
        transactionPatterns.goods
    );
}

function transactionCountOpacity(count) {
    if (count <= 2) {
        return 0.25;
    }

    if (count <= 5) {
        return 0.45;
    }

    if (count <= 10) {
        return 0.70;
    }

    return 0.95;
}

const simulation =
    d3.forceSimulation()
        .force(
            "link",
            d3.forceLink()
                .id(
                    d => d.id
                )
                .distance(175)
                .strength(0.35)
        )
        .force(
            "charge",
            d3.forceManyBody()
                .strength(-340)
        )
        .force(
            "center",
            d3.forceCenter(
                width / 2,
                height / 2 + 45
            )
        )
        .force(
            "x",
            d3.forceX(
                width / 2
            )
                .strength(0.035)
        )
        .force(
            "y",
            d3.forceY(
                height / 2 + 45
            )
                .strength(0.035)
        )
        .force(
            "collision",
            d3.forceCollide()
                .radius(52)
        )
        .on(
            "tick",
            ticked
        );

function keepInside(d) {
    const radius = 34;

    d.x =
        Math.max(
            55 + radius,
            Math.min(
                width - 55 - radius,
                d.x
            )
        );

    d.y =
        Math.max(
            105 + radius,
            Math.min(
                height - 55 - radius,
                d.y
            )
        );
}

function ticked() {
    companies.forEach(
        keepInside
    );

    linksGroup
        .selectAll(
            ".network-link"
        )
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
        .selectAll(
            ".network-node"
        )
        .attr(
            "transform",
            d =>
                `translate(${d.x},${d.y})`
        );

    labelsGroup
        .selectAll(
            ".node-label"
        )
        .attr(
            "transform",
            d =>
                `translate(${d.x},${d.y + 43})`
        );
}

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
        d =>
            d.amount_usd
    );
}

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

function aggregateLinks(
    currentTransactions
) {
    const grouped =
        d3.rollup(
            currentTransactions,
            values => ({
                source:
                    values[0].source,

                target:
                    values[0].target,

                amount_usd:
                    d3.sum(
                        values,
                        d =>
                            d.amount_usd
                    ),

                transaction_count:
                    d3.sum(
                        values,
                        d =>
                            d.transaction_count
                    ),

                transaction_types:
                    [
                        ...new Set(
                            values.map(
                                d =>
                                    String(
                                        d.transaction_type
                                    )
                                        .toLowerCase()
                                        .trim()
                            )
                        )
                    ]
            }),
            d =>
                linkKey(d)
        );

    return Array.from(
        grouped.values()
    );
}

function getCompany(id) {
    return companies.find(
        d =>
            d.id === id
    );
}

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

function highlightConnections(
    companyId
) {
    linksGroup
        .selectAll(
            ".network-link"
        )
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

                return (
                    source === companyId ||
                    target === companyId
                )
                    ? 1
                    : 0.12;
            }
        );

    nodesGroup
        .selectAll(
            ".network-node"
        )
        .style(
            "opacity",
            d =>
                d.id === companyId
                    ? 1
                    : 0.35
        );

    labelsGroup
        .selectAll(
            ".node-label"
        )
        .style(
            "opacity",
            d =>
                d.id === companyId
                    ? 1
                    : 0.35
        );
}

function resetHighlight() {
    linksGroup
        .selectAll(
            ".network-link"
        )
        .style(
            "opacity",
            d =>
                transactionCountOpacity(
                    d.transaction_count
                )
        );

    nodesGroup
        .selectAll(
            ".network-node"
        )
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

    labelsGroup
        .selectAll(
            ".node-label"
        )
        .style(
            "opacity",
            1
        );
}

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
            d =>
                d.amount_usd
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
            18
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
            36
        )
        .text(
            `Total transaction value: $${d3.format(",.0f")(totalValue)}`
        );
}

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
        simulation
            .alphaTarget(0);
    }

    d.fx = null;
    d.fy = null;
}

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
        d3.max(
            volumes
        ) || 1;

    nodeSizeScale.domain([
        0,
        maxVolume
    ]);

    const simulationLinks =
        currentLinks.map(
            d => ({
                source:
                    d.source,

                target:
                    d.target,

                amount_usd:
                    d.amount_usd,

                transaction_count:
                    d.transaction_count,

                transaction_types:
                    d.transaction_types
            })
        );

    const linkSelection =
        linksGroup
            .selectAll(
                ".network-link"
            )
            .data(
                simulationLinks,
                d =>
                    linkKey(d)
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
            .attr(
                "stroke-dasharray",
                d =>
                    getTransactionPattern(d)
            )
            .style(
                "opacity",
                0
            );

    linkEnter
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
                    getCompany(
                        sourceId
                    );

                const target =
                    getCompany(
                        targetId
                    );

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
                        $${d3.format(",.0f")(
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
                        "opacity",
                        transactionCountOpacity(
                            d.transaction_count
                        )
                    )
                    .style(
                        "stroke-width",
                        linkWidthScale(
                            d.amount_usd
                        )
                    )
                    .attr(
                        "stroke-dasharray",
                        getTransactionPattern(d)
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
        .attr(
            "stroke-dasharray",
            d =>
                getTransactionPattern(d)
        )
        .style(
            "opacity",
            d =>
                transactionCountOpacity(
                    d.transaction_count
                )
        );

    const nodeSelection =
        nodesGroup
            .selectAll(
                ".network-node"
            )
            .data(
                companies,
                d =>
                    d.id
            );

    nodeSelection
        .exit()
        .remove();

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
            );

    nodeEnter
        .append("path");

    nodeEnter
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
                        $${d3.format(",.0f")(
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

    const labelSelection =
        labelsGroup
            .selectAll(
                ".node-label"
            )
            .data(
                companies,
                d =>
                    d.id
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

function getAvailableDates() {
    return Array.from(
        new Set(
            transactions.map(
                d =>
                    d3.timeFormat(
                        "%Y-%m-%d"
                    )(d.date)
            )
        )
    ).sort();
}

function getDateForDay(
    day
) {
    const dates =
        getAvailableDates();

    if (!dates.length) {
        return null;
    }

    const index =
        Math.max(
            0,
            Math.min(
                dates.length - 1,
                +day - 1
            )
        );

    return d3.timeParse(
        "%Y-%m-%d"
    )(
        dates[index]
    );
}

function getDayForDate(
    dateString
) {
    const dates =
        getAvailableDates();

    const index =
        dates.indexOf(
            dateString
        );

    if (index === -1) {
        return null;
    }

    return index + 1;
}

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

    d3.select("#day-label")
        .text(
            `Day ${currentDay}`
        );

    dateLabel.text(
        formattedDate
    );
}

function showDay(day) {
    const totalDays =
        getAvailableDates().length;

    if (!totalDays) {
        return;
    }

    currentDay =
        Math.max(
            1,
            Math.min(
                totalDays,
                +day
            )
        );

    const currentDate =
        getDateForDay(
            currentDay
        );

    const dateString =
        d3.timeFormat(
            "%Y-%m-%d"
        )(currentDate);

    const currentTransactions =
        transactions.filter(
            d =>
                d3.timeFormat(
                    "%Y-%m-%d"
                )(d.date) ===
                dateString
        );

    updateDateControls();

    updateNetwork(
        currentTransactions
    );
}

function play() {
    if (timer !== null) {
        return;
    }

    const totalDays =
        getAvailableDates().length;

    if (!totalDays) {
        return;
    }

    if (currentDay >= totalDays) {
        showDay(1);
    }

    timer =
        d3.interval(
            () => {
                if (
                    currentDay >=
                    totalDays
                ) {
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

function pause() {
    if (timer !== null) {
        timer.stop();
        timer = null;
    }
}

function reset() {
    pause();
    showDay(1);
}

function formatLegendValue(
    value
) {
    if (!Number.isFinite(value)) {
        return "—";
    }

    if (value >= 1000000) {
        return `$${d3.format(".0f")(
            value / 1000000
        )}M`;
    }

    if (value >= 1000) {
        return `$${d3.format(".0f")(
            value / 1000
        )}K`;
    }

    return `$${d3.format(".0f")(
        value
    )}`;
}

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
            "Company sector (Node color)"
        );

    const sectors =
        Array.from(
            new Set(
                companies.map(
                    d => d.sector
                )
            )
        );

    const sectorList =
        legend
            .append("div")
            .attr(
                "class",
                "lab7-sector-list"
            );

    sectors.forEach(
        sector => {
            const item =
                sectorList
                    .append("div")
                    .attr(
                        "class",
                        "lab7-legend-item"
                    );

            item
                .append("span")
                .attr(
                    "class",
                    "lab7-sector-dot"
                )
                .style(
                    "background-color",
                    sectorColors(
                        sector
                    )
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
            "Geographic region (Node shape)"
        );

    const regions =
        Array.from(
            new Set(
                companies.map(
                    d => d.region
                )
            )
        );

    const regionList =
        legend
            .append("div")
            .attr(
                "class",
                "lab7-region-list"
            );

    regions.forEach(
        region => {
            const row =
                regionList
                    .append("div")
                    .attr(
                        "class",
                        "lab7-region-item"
                    );

            const regionSvg =
                row
                    .append("svg")
                    .attr(
                        "width",
                        24
                    )
                    .attr(
                        "height",
                        24
                    )
                    .attr(
                        "viewBox",
                        "0 0 24 24"
                    );

            regionSvg
                .append("path")
                .attr(
                    "d",
                    d3.symbol()
                        .type(
                            regionSymbols(
                                region
                            )
                        )
                        .size(
                            130
                        )
                )
                .attr(
                    "transform",
                    "translate(12,12)"
                )
                .attr(
                    "fill",
                    "#ffffff"
                )
                .attr(
                    "stroke",
                    "#333333"
                )
                .attr(
                    "stroke-width",
                    1.3
                );

            row
                .append("span")
                .text(
                    region
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
            "Transaction volume (Node size)"
        );

    const volumeLegend =
        legend
            .append("div")
            .attr(
                "class",
                "lab7-size-legend"
            );

    const volumeExamples = [
        {
            label: "Low",
            range: "< $10K",
            radius: 7
        },
        {
            label: "Medium",
            range: "$10K–$50K",
            radius: 15
        },
        {
            label: "High",
            range: "> $50K",
            radius: 22
        }
    ];

    volumeExamples.forEach(
        item => {
            const group =
                volumeLegend
                    .append("div")
                    .attr(
                        "class",
                        "lab7-size-item"
                    );

            group
                .append("svg")
                .attr(
                    "width",
                    55
                )
                .attr(
                    "height",
                    48
                )
                .attr(
                    "viewBox",
                    "0 0 55 48"
                )
                .append("circle")
                .attr(
                    "cx",
                    27.5
                )
                .attr(
                    "cy",
                    24
                )
                .attr(
                    "r",
                    item.radius
                )
                .attr(
                    "fill",
                    "#d1d5db"
                )
                .attr(
                    "stroke",
                    "#555555"
                );

            group
                .append("span")
                .text(
                    item.label
                );

            group
                .append("small")
                .text(
                    item.range
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
            "Transaction type (Link pattern)"
        );

    const patternList =
        legend
            .append("div")
            .attr(
                "class",
                "lab7-pattern-list"
            );

    const patternExamples = [
        {
            label: "Goods",
            pattern:
                transactionPatterns.goods
        },
        {
            label: "Materials",
            pattern:
                transactionPatterns.materials
        },
        {
            label: "Services",
            pattern:
                transactionPatterns.services
        },
        {
            label: "Shipping",
            pattern:
                transactionPatterns.shipping
        },
        {
            label: "Components",
            pattern:
                transactionPatterns.components
        }
    ];

    patternExamples.forEach(
        item => {
            const row =
                patternList
                    .append("div")
                    .attr(
                        "class",
                        "lab7-pattern-item"
                    );

            row
                .append("svg")
                .attr(
                    "width",
                    105
                )
                .attr(
                    "height",
                    17
                )
                .attr(
                    "viewBox",
                    "0 0 105 17"
                )
                .append("line")
                .attr(
                    "x1",
                    1
                )
                .attr(
                    "y1",
                    8.5
                )
                .attr(
                    "x2",
                    104
                )
                .attr(
                    "y2",
                    8.5
                )
                .attr(
                    "stroke",
                    "#555555"
                )
                .attr(
                    "stroke-width",
                    2.3
                )
                .attr(
                    "stroke-linecap",
                    "round"
                )
                .attr(
                    "stroke-dasharray",
                    item.pattern
                );

            row
                .append("span")
                .text(
                    item.label
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
            "Transaction amount (Link thickness)"
        );

    const amountList =
        legend
            .append("div")
            .attr(
                "class",
                "lab7-line-size-list"
            );

    const amountExamples = [
        {
            label: "< $10K",
            width: 2.5
        },
        {
            label: "$10K–$50K",
            width: 4
        },
        {
            label: "$50K–$100K",
            width: 6
        },
        {
            label: "> $100K",
            width: 8
        }
    ];

    amountExamples.forEach(
        item => {
            const row =
                amountList
                    .append("div")
                    .attr(
                        "class",
                        "lab7-line-size-item"
                    );

            row
                .append("svg")
                .attr(
                    "width",
                    105
                )
                .attr(
                    "height",
                    17
                )
                .attr(
                    "viewBox",
                    "0 0 105 17"
                )
                .append("line")
                .attr(
                    "x1",
                    1
                )
                .attr(
                    "y1",
                    8.5
                )
                .attr(
                    "x2",
                    104
                )
                .attr(
                    "y2",
                    8.5
                )
                .attr(
                    "stroke",
                    "#555555"
                )
                .attr(
                    "stroke-width",
                    item.width
                )
                .attr(
                    "stroke-linecap",
                    "round"
                );

            row
                .append("span")
                .text(
                    item.label
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
            "Transaction count (Link opacity)"
        );

    const opacityList =
        legend
            .append("div")
            .attr(
                "class",
                "lab7-opacity-list"
            );

    const opacityExamples = [
        {
            label: "1–2 transactions",
            opacity: 0.25
        },
        {
            label: "3–5 transactions",
            opacity: 0.45
        },
        {
            label: "6–10 transactions",
            opacity: 0.70
        },
        {
            label: ">10 transactions",
            opacity: 0.95
        }
    ];

    opacityExamples.forEach(
        item => {
            const row =
                opacityList
                    .append("div")
                    .attr(
                        "class",
                        "lab7-opacity-item"
                    );

            row
                .append("svg")
                .attr(
                    "width",
                    105
                )
                .attr(
                    "height",
                    17
                )
                .attr(
                    "viewBox",
                    "0 0 105 17"
                )
                .append("line")
                .attr(
                    "x1",
                    1
                )
                .attr(
                    "y1",
                    8.5
                )
                .attr(
                    "x2",
                    104
                )
                .attr(
                    "y2",
                    8.5
                )
                .attr(
                    "stroke",
                    "#555555"
                )
                .attr(
                    "stroke-width",
                    5
                )
                .attr(
                    "stroke-linecap",
                    "round"
                )
                .attr(
                    "opacity",
                    item.opacity
                );

            row
                .append("span")
                .text(
                    item.label
                );
        }
    );

    legend
        .append("p")
        .attr(
            "class",
            "lab7-legend-note"
        )
        .text(
            "Links are undirected and represent active commercial relationships."
        );
}

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
                )(
                    d.date
                ),

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

        const sectors =
            [
                ...new Set(
                    companies.map(
                        d =>
                            d.sector
                    )
                )
            ];

        const regions =
            [
                ...new Set(
                    companies.map(
                        d =>
                            d.region
                    )
                )
            ];

        sectorColors.domain(
            sectors
        );

        regionSymbols.domain(
            regions
        );

        companies.forEach(
            (d, i) => {
                const angle =
                    (
                        i /
                        companies.length
                    ) *
                    Math.PI *
                    2;

                const radius =
                    255;

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

        const availableDates =
            getAvailableDates();

        const totalDays =
            availableDates.length;

        d3.select(
            "#time-slider"
        )
            .attr(
                "min",
                1
            )
            .attr(
                "max",
                totalDays
            )
            .attr(
                "value",
                1
            )
            .attr(
                "step",
                1
            );

        if (
            availableDates.length
        ) {
            d3.select(
                "#date-picker"
            )
                .attr(
                    "min",
                    availableDates[0]
                )
                .attr(
                    "max",
                    availableDates[
                        availableDates.length - 1
                    ]
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

        d3.select(
            "#visualization"
        )
            .html(
                `
                <div class="error-message">
                    Unable to load the Lab 7 data.
                    <br>
                    ${error.message}
                </div>
                `
            );
    }
);

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