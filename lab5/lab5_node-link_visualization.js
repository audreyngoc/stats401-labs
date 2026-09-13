// lab 5 — interactive network visualization

const width = 1200;
const height = 730;

const svg = d3.select("#visualization").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto")
    .style("display", "block");

Promise.all([
    d3.csv("../data/lab5_assignment_stations.csv", d => ({
        id: d.id,
        station_name: d.station_name,
        district: d.district,
        daily_passengers: +d.daily_passengers,
        station_type: d.station_type
    })),
    d3.csv("../data/lab5_assignment_routes.csv", d => ({
        source: d.source,
        target: d.target,
        travel_time_min: +d.travel_time_min,
        route_type: d.route_type
    }))
]).then(([nodes, links]) => {

    const graphLeft = 260;
    const graphRight = 1180;
    const graphTop = 20;
    const graphBottom = 710;

    const graphCenterX = (graphLeft + graphRight) / 2;
    const graphCenterY = (graphTop + graphBottom) / 2;

    const graphWidth = graphRight - graphLeft;
    const graphHeight = graphBottom - graphTop;

    const networkTop = graphTop + 68;
    const networkBottom = graphBottom - 22;
    const networkLeft = graphLeft + 20;
    const networkRight = graphRight - 12;

    const sizeScale = d3.scaleSqrt()
        .domain(d3.extent(nodes, d => d.daily_passengers))
        .range([7, 16]);

    const passengerCategory = p =>
        p < 4000 ? "low" :
        p <= 7000 ? "medium" :
        "high";

    const districts = [
        "West",
        "North",
        "East",
        "Central",
        "South"
    ];

    const districtColorScale = d3.scaleOrdinal()
        .domain(districts)
        .range([
            "#E45756",
            "#F28E2B",
            "#59A14F",
            "#4E79A7",
            "#9C6ADE"
        ]);

    const districtCenters = {
        West: {
            x: graphLeft + 125,
            y: graphCenterY - 25
        },
        North: {
            x: graphCenterX + 5,
            y: networkTop + 95
        },
        East: {
            x: graphRight - 120,
            y: graphCenterY - 20
        },
        Central: {
            x: graphCenterX - 45,
            y: graphCenterY + 125
        },
        South: {
            x: graphRight - 210,
            y: graphBottom - 105
        }
    };

    const routeTypes = [
        ...new Set(links.map(d => d.route_type))
    ];

    const routePatterns = {
        metro: "",
        express: "12,6",
        shuttle: "3,5"
    };

    const fallbackPatterns = [
        "",
        "12,6",
        "3,5",
        "18,5,2,5",
        "2,5"
    ];

    const routePatternScale = d3.scaleOrdinal()
        .domain(routeTypes)
        .range(
            routeTypes.map((type, i) =>
                routePatterns[type.toLowerCase()] ??
                fallbackPatterns[
                    i % fallbackPatterns.length
                ]
            )
        );

    const travelIntervals = [
        {
            label: "0–5 min",
            min: 0,
            max: 5,
            width: 1.25
        },
        {
            label: "6–10 min",
            min: 6,
            max: 10,
            width: 3.25
        },
        {
            label: "11–15 min",
            min: 11,
            max: 15,
            width: 5.5
        },
        {
            label: "16–20 min",
            min: 16,
            max: 20,
            width: 8.5
        }
    ];

    const travelWidth = time =>
        travelIntervals.find(
            interval =>
                time >= interval.min &&
                time <= interval.max
        )?.width ?? 1.25;

    const travelInterval = time =>
        travelIntervals.find(
            interval =>
                time >= interval.min &&
                time <= interval.max
        )?.label ?? `${time} min`;

    const tooltip = d3.select(".tooltip")
        .style("position", "fixed");

    let currentZoom = d3.zoomIdentity;
    let hoveredNode = null;
    let hoveredLink = null;

    const graph = svg.append("g")
        .attr("class", "graph-container");

    graph.append("rect")
        .attr("x", graphLeft)
        .attr("y", graphTop - 10)
        .attr("width", graphWidth)
        .attr("height", graphHeight + 10)
        .attr("rx", 12)
        .attr("fill", "#fff")
        .attr("stroke", "#e0e0e0");

    graph.append("text")
        .attr("x", graphLeft + 20)
        .attr("y", graphTop + 27)
        .text("Station Connections")
        .attr("font-size", 18)
        .attr("font-weight", "600")
        .attr("fill", "#222");

    graph.append("text")
        .attr("x", graphLeft + 20)
        .attr("y", graphTop + 48)
        .text("Hover over a station to highlight its connections")
        .attr("font-size", 11)
        .attr("fill", "#777");

    const clipId = "network-clip-lab5";

    svg.append("defs")
        .append("clipPath")
        .attr("id", clipId)
        .attr("clipPathUnits", "userSpaceOnUse")
        .append("rect")
        .attr("x", networkLeft)
        .attr("y", networkTop)
        .attr("width", networkRight - networkLeft)
        .attr("height", networkBottom - networkTop)
        .attr("rx", 8);

    const viewport = graph.append("g")
        .attr("class", "network-viewport")
        .attr(
            "clip-path",
            `url(#${clipId})`
        );

    const zoomLayer = viewport.append("g")
        .attr("class", "zoom-layer");

    const link = zoomLayer.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", "#506070")
        .attr(
            "stroke-width",
            d => travelWidth(d.travel_time_min)
        )
        .attr(
            "stroke-dasharray",
            d => routePatternScale(d.route_type)
        )
        .attr("stroke-opacity", 0.22)
        .attr("stroke-linecap", "round")
        .style("cursor", "pointer");

    const node = zoomLayer.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .attr("class", "node")
        .style("cursor", "grab");

    node.each(function(d) {

        const g = d3.select(this);
        const r = sizeScale(d.daily_passengers);

        if (d.station_type === "Local") {

            g.append("circle")
                .attr("class", "node-shape")
                .attr("r", r);

        } else if (d.station_type === "Transfer") {

            g.append("path")
                .attr("class", "node-shape")
                .attr(
                    "d",
                    `M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`
                );

        } else {

            g.append("rect")
                .attr("class", "node-shape")
                .attr("x", -r)
                .attr("y", -r)
                .attr("width", r * 2)
                .attr("height", r * 2);
        }
    });

    node.selectAll(".node-shape")
        .attr(
            "fill",
            d => districtColorScale(d.district)
        )
        .attr("stroke", "#263238")
        .attr("stroke-width", 1.5);

    node.append("text")
        .attr("class", "station-label")
        .text(
            d => d.id.replace(/^s/i, "")
        )
        .attr("text-anchor", "middle")
        .attr(
            "dominant-baseline",
            "central"
        )
        .attr("fill", "white")
        .attr(
            "font-size",
            d =>
                Math.max(
                    10,
                    sizeScale(
                        d.daily_passengers
                    ) * 0.72
                )
        )
        .attr("font-weight", "600")
        .attr(
            "font-family",
            "Arial, sans-serif"
        )
        .attr(
            "pointer-events",
            "none"
        );

    const districtNodes = d3.group(
        nodes,
        d => d.district
    );

    function keepInside(d) {

        const r =
            sizeScale(
                d.daily_passengers
            ) + 30;

        d.x = Math.max(
            networkLeft + r,
            Math.min(
                networkRight - r,
                d.x
            )
        );

        d.y = Math.max(
            networkTop + r,
            Math.min(
                networkBottom - r,
                d.y
            )
        );
    }

    districtNodes.forEach(
        (groupNodes, district) => {

            const center =
                districtCenters[district];

            groupNodes.forEach(
                (d, i) => {

                    const angle =
                        (i /
                            Math.max(
                                groupNodes.length,
                                1
                            )) *
                            Math.PI *
                            2 -
                        Math.PI / 2;

                    const ring =
                        92 +
                        (i % 2) * 38 +
                        Math.floor(i / 6) * 16;

                    d.x =
                        center.x +
                        Math.cos(angle) *
                            ring;

                    d.y =
                        center.y +
                        Math.sin(angle) *
                            ring;

                    keepInside(d);
                }
            );
        }
    );

    const simulation =
        d3.forceSimulation(nodes)
            .force(
                "link",
                d3.forceLink(links)
                    .id(d => d.id)
                    .distance(142)
                    .strength(0.34)
            )
            .force(
                "charge",
                d3.forceManyBody()
                    .strength(-510)
                    .distanceMax(520)
            )
            .force(
                "collision",
                d3.forceCollide()
                    .radius(
                        d =>
                            sizeScale(
                                d.daily_passengers
                            ) + 28
                    )
                    .strength(0.92)
            )
            .force(
                "x",
                d =>
                    d3.forceX(
                        districtCenters[
                            d.district
                        ]?.x ??
                            graphCenterX
                    ).strength(0.038)
            )
            .force(
                "y",
                d =>
                    d3.forceY(
                        districtCenters[
                            d.district
                        ]?.y ??
                            graphCenterY
                    ).strength(0.038)
            )
            .alpha(0.9)
            .alphaDecay(0.032)
            .velocityDecay(0.68);

    simulation.on("tick", () => {

        nodes.forEach(keepInside);

        link
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

        node.attr(
            "transform",
            d =>
                `translate(${d.x},${d.y})`
        );
    });

    function dragStarted(event, d) {

        event.sourceEvent.stopPropagation();

        if (!event.active) {
            simulation
                .alphaTarget(0.08)
                .restart();
        }

        d.fx = d.x;
        d.fy = d.y;

        d3.select(this)
            .style(
                "cursor",
                "grabbing"
            );
    }

    function dragged(event, d) {

        const r =
            sizeScale(
                d.daily_passengers
            ) + 30;

        d.fx = Math.max(
            networkLeft + r,
            Math.min(
                networkRight - r,
                event.x
            )
        );

        d.fy = Math.max(
            networkTop + r,
            Math.min(
                networkBottom - r,
                event.y
            )
        );
    }

    function dragEnded(event, d) {

        if (!event.active) {
            simulation.alphaTarget(0);
        }

        d.fx = null;
        d.fy = null;

        d3.select(this)
            .style(
                "cursor",
                "grab"
            );
    }

    node.call(
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

    const endpointId = x =>
        x.id || x;

    const connected = (a, b) =>
        links.some(l =>
            (
                endpointId(l.source) ===
                    a.id &&
                endpointId(l.target) ===
                    b.id
            ) ||
            (
                endpointId(l.source) ===
                    b.id &&
                endpointId(l.target) ===
                    a.id
            )
        );

    const routesFor = station =>
        links.filter(l =>
            endpointId(l.source) ===
                station.id ||
            endpointId(l.target) ===
                station.id
        );

    const otherStation = (
        route,
        station
    ) =>
        nodes.find(n =>
            n.id ===
                (
                    endpointId(
                        route.source
                    ) === station.id
                        ? endpointId(
                            route.target
                        )
                        : endpointId(
                            route.source
                        )
                )
        );

    function networkBounds() {

        const r =
            svg.node()
                .getBoundingClientRect();

        const sx =
            r.width / width;

        const sy =
            r.height / height;

        return {
            left:
                r.left +
                networkLeft * sx,

            right:
                r.left +
                networkRight * sx,

            top:
                r.top +
                networkTop * sy,

            bottom:
                r.top +
                networkBottom * sy
        };
    }

    function transformedPoint(
        x,
        y
    ) {
        return currentZoom.apply([
            x,
            y
        ]);
    }

    function placeTooltip(
        x,
        y
    ) {

        tooltip
            .style(
                "display",
                "block"
            )
            .style(
                "visibility",
                "hidden"
            )
            .style(
                "opacity",
                1
            );

        const tooltipNode =
            tooltip.node();

        if (!tooltipNode) {
            return;
        }

        const t =
            tooltipNode
                .getBoundingClientRect();

        const b =
            networkBounds();

        const gap = 14;
        const margin = 8;

        let left =
            x + gap;

        let top =
            y + gap;

        if (
            left + t.width >
            b.right - margin
        ) {
            left =
                x -
                t.width -
                gap;
        }

        if (
            left <
            b.left + margin
        ) {
            left =
                x -
                t.width / 2;
        }

        if (
            top + t.height >
            b.bottom - margin
        ) {
            top =
                y -
                t.height -
                gap;
        }

        if (
            top <
            b.top + margin
        ) {
            top =
                y -
                t.height / 2;
        }

        left = Math.max(
            b.left + margin,
            Math.min(
                b.right -
                    t.width -
                    margin,
                left
            )
        );

        top = Math.max(
            b.top + margin,
            Math.min(
                b.bottom -
                    t.height -
                    margin,
                top
            )
        );

        tooltip
            .style(
                "left",
                `${left}px`
            )
            .style(
                "top",
                `${top}px`
            )
            .style(
                "visibility",
                "visible"
            );
    }

    function placeNodeTooltip(d) {

        const [x, y] =
            transformedPoint(
                d.x,
                d.y
            );

        const r =
            svg.node()
                .getBoundingClientRect();

        placeTooltip(
            r.left +
                x *
                    r.width /
                    width,

            r.top +
                y *
                    r.height /
                    height
        );
    }

    function placeLinkTooltip(d) {

        const [x, y] =
            transformedPoint(
                (
                    d.source.x +
                    d.target.x
                ) / 2,

                (
                    d.source.y +
                    d.target.y
                ) / 2
            );

        const r =
            svg.node()
                .getBoundingClientRect();

        placeTooltip(
            r.left +
                x *
                    r.width /
                    width,

            r.top +
                y *
                    r.height /
                    height
        );
    }

    function highlightStation(
        station
    ) {

        node.interrupt()
            .transition()
            .duration(180)
            .attr(
                "opacity",
                n =>
                    n.id ===
                        station.id ||
                    connected(
                        station,
                        n
                    )
                        ? 1
                        : 0.10
            );

        link.interrupt()
            .transition()
            .duration(180)
            .attr(
                "stroke-opacity",
                l =>
                    endpointId(
                        l.source
                    ) === station.id ||
                    endpointId(
                        l.target
                    ) === station.id
                        ? 1
                        : 0.035
            )
            .attr(
                "stroke-width",
                l => {

                    const active =
                        endpointId(
                            l.source
                        ) === station.id ||
                        endpointId(
                            l.target
                        ) === station.id;

                    return active
                        ? travelWidth(
                            l.travel_time_min
                        ) * 1.15
                        : travelWidth(
                            l.travel_time_min
                        );
                }
            );

        node.selectAll(
            ".node-shape"
        )
            .interrupt()
            .transition()
            .duration(180)
            .attr(
                "stroke-width",
                n =>
                    n.id === station.id
                        ? 3
                        : connected(
                            station,
                            n
                        )
                            ? 2
                            : 1.2
            );

        node.selectAll(
            ".station-label"
        )
            .interrupt()
            .transition()
            .duration(180)
            .attr(
                "opacity",
                n =>
                    n.id === station.id ||
                    connected(
                        station,
                        n
                    )
                        ? 1
                        : 0.10
            );
    }

    function resetNetwork() {

        node.interrupt()
            .transition()
            .duration(250)
            .attr(
                "opacity",
                1
            );

        link.interrupt()
            .transition()
            .duration(250)
            .attr(
                "stroke-opacity",
                0.22
            )
            .attr(
                "stroke-width",
                d =>
                    travelWidth(
                        d.travel_time_min
                    )
            );

        node.selectAll(
            ".node-shape"
        )
            .interrupt()
            .transition()
            .duration(250)
            .attr(
                "stroke-width",
                1.5
            );

        node.selectAll(
            ".station-label"
        )
            .interrupt()
            .transition()
            .duration(250)
            .attr(
                "opacity",
                1
            );
    }

    function hideTooltip() {

        hoveredNode = null;
        hoveredLink = null;

        resetNetwork();

        tooltip
            .style(
                "display",
                "none"
            )
            .style(
                "visibility",
                "hidden"
            )
            .style(
                "opacity",
                0
            );
    }

    node
        .on(
            "mouseover",
            function(event, d) {

                hoveredNode = d;
                hoveredLink = null;

                highlightStation(d);

                const routes =
                    routesFor(d);

                const html =
                    routes.length
                        ? routes
                            .map(r => {

                                const other =
                                    otherStation(
                                        r,
                                        d
                                    );

                                return `
                                    <div style="margin-top:4px;">
                                        • ${
                                            other
                                                ?.station_name ??
                                            "Unknown station"
                                        }
                                        (${r.travel_time_min} min, ${r.route_type})
                                    </div>
                                `;
                            })
                            .join("")
                        : "<em>No direct connections</em>";

                tooltip.html(`
                    <strong>${d.station_name}</strong><br>
                    District: ${d.district}<br>
                    Station Type: ${d.station_type}<br>
                    Daily Passengers: ${d.daily_passengers.toLocaleString()}<br>
                    Passenger Volume: ${passengerCategory(d.daily_passengers)}
                    <hr style="border:0;border-top:1px solid #ddd;margin:7px 0;">
                    <strong>Connected Stations:</strong>
                    ${html}
                `);

                placeNodeTooltip(d);
            }
        )
        .on(
            "mousemove",
            (event, d) =>
                placeNodeTooltip(d)
        )
        .on(
            "mouseout",
            hideTooltip
        );

    link
        .on(
            "mouseover",
            function(event, d) {

                hoveredLink = d;
                hoveredNode = null;

                const sourceId =
                    endpointId(
                        d.source
                    );

                const targetId =
                    endpointId(
                        d.target
                    );

                d3.select(this)
                    .interrupt()
                    .transition()
                    .duration(120)
                    .attr(
                        "stroke-opacity",
                        1
                    )
                    .attr(
                        "stroke-width",
                        travelWidth(
                            d.travel_time_min
                        ) * 1.15
                    );

                node.interrupt()
                    .transition()
                    .duration(120)
                    .attr(
                        "opacity",
                        n =>
                            n.id === sourceId ||
                            n.id === targetId
                                ? 1
                                : 0.20
                    );

                const source =
                    nodes.find(
                        n =>
                            n.id ===
                            sourceId
                    );

                const target =
                    nodes.find(
                        n =>
                            n.id ===
                            targetId
                    );

                tooltip.html(`
                    <strong>
                        ${
                            source
                                ?.station_name ??
                            sourceId
                        }
                        ↔
                        ${
                            target
                                ?.station_name ??
                            targetId
                        }
                    </strong><br>
                    Route Type: ${d.route_type}<br>
                    Travel Time: ${d.travel_time_min} min<br>
                    Travel-Time Interval: ${travelInterval(d.travel_time_min)}
                `);

                placeLinkTooltip(d);
            }
        )
        .on(
            "mousemove",
            (event, d) =>
                placeLinkTooltip(d)
        )
        .on(
            "mouseout",
            hideTooltip
        );

    const zoom =
        d3.zoom()
            .scaleExtent([
                0.80,
                2.35
            ])
            .extent([
                [
                    networkLeft,
                    networkTop
                ],
                [
                    networkRight,
                    networkBottom
                ]
            ])
            .translateExtent([
                [
                    networkLeft,
                    networkTop
                ],
                [
                    networkRight,
                    networkBottom
                ]
            ])
            .on(
                "zoom",
                event => {

                    currentZoom =
                        event.transform;

                    zoomLayer.attr(
                        "transform",
                        event.transform
                    );

                    node.selectAll(
                        ".node-shape"
                    )
                        .attr(
                            "stroke-width",
                            1.5 /
                                event.transform.k
                        );

                    if (hoveredNode) {
                        placeNodeTooltip(
                            hoveredNode
                        );
                    } else if (
                        hoveredLink
                    ) {
                        placeLinkTooltip(
                            hoveredLink
                        );
                    }
                }
            );

    graph
        .call(zoom)
        .call(
            zoom.transform,
            d3.zoomIdentity
        );

    const controls =
        svg.append("g")
            .attr(
                "class",
                "zoom-controls"
            )
            .attr(
                "transform",
                `translate(${graphRight - 120},${graphTop + 20})`
            );

    controls.append("rect")
        .attr("x", -10)
        .attr("y", -10)
        .attr("width", 110)
        .attr("height", 38)
        .attr("rx", 7)
        .attr("fill", "white")
        .attr("stroke", "#ddd");

    controls.append("text")
        .attr("x", 12)
        .attr("y", 17)
        .attr(
            "text-anchor",
            "middle"
        )
        .text("+")
        .attr("font-size", 20)
        .attr(
            "font-weight",
            "600"
        )
        .style(
            "cursor",
            "pointer"
        )
        .on(
            "click",
            e => {

                e.stopPropagation();

                graph
                    .transition()
                    .duration(300)
                    .call(
                        zoom.scaleBy,
                        1.35
                    );
            }
        );

    controls.append("line")
        .attr("x1", 30)
        .attr("x2", 30)
        .attr("y1", 2)
        .attr("y2", 28)
        .attr("stroke", "#ddd");

    controls.append("text")
        .attr("x", 43)
        .attr("y", 17)
        .attr(
            "text-anchor",
            "middle"
        )
        .text("−")
        .attr("font-size", 20)
        .attr(
            "font-weight",
            "600"
        )
        .style(
            "cursor",
            "pointer"
        )
        .on(
            "click",
            e => {

                e.stopPropagation();

                graph
                    .transition()
                    .duration(300)
                    .call(
                        zoom.scaleBy,
                        0.74
                    );
            }
        );

    controls.append("line")
        .attr("x1", 61)
        .attr("x2", 61)
        .attr("y1", 2)
        .attr("y2", 28)
        .attr("stroke", "#ddd");

    controls.append("circle")
        .attr("cx", 82)
        .attr("cy", 9)
        .attr("r", 9)
        .attr("fill", "white")
        .attr(
            "stroke",
            "#bdbdbd"
        )
        .style(
            "cursor",
            "pointer"
        )
        .on(
            "click",
            e => {

                e.stopPropagation();

                graph
                    .transition()
                    .duration(400)
                    .call(
                        zoom.transform,
                        d3.zoomIdentity
                    );
            }
        );

    controls.append("path")
        .attr(
            "d",
            "M 77 9 L 82 4 L 87 9 M 79 8 L 79 14 L 85 14 L 85 8"
        )
        .attr(
            "fill",
            "none"
        )
        .attr(
            "stroke",
            "#555"
        )
        .attr(
            "stroke-width",
            1.5
        )
        .attr(
            "stroke-linecap",
            "round"
        )
        .attr(
            "stroke-linejoin",
            "round"
        )
        .style(
            "pointer-events",
            "none"
        );

    graph.append("text")
        .attr(
            "x",
            graphRight - 20
        )
        .attr(
            "y",
            graphBottom - 14
        )
        .attr(
            "text-anchor",
            "end"
        )
        .text(
            "Scroll to zoom • Drag stations to explore"
        )
        .attr(
            "font-size",
            11
        )
        .attr(
            "fill",
            "#666"
        );

    const legend =
        svg.append("g")
            .attr(
                "class",
                "legend"
            )
            .attr(
                "transform",
                "translate(25,25)"
            );

    legend.append("rect")
        .attr("x", -15)
        .attr("y", -15)
        .attr("width", 230)
        .attr("height", 700)
        .attr("rx", 10)
        .attr(
            "fill",
            "#faf7f7"
        )
        .attr(
            "stroke",
            "#ddd"
        );

    legend.append("text")
        .text(
            "Transit Network"
        )
        .attr("x", 5)
        .attr("y", 15)
        .attr(
            "font-size",
            18
        )
        .attr(
            "font-weight",
            "600"
        )
        .attr(
            "fill",
            "#222"
        );

    legend.append("text")
        .text(
            "Node-link visualization"
        )
        .attr("x", 5)
        .attr("y", 37)
        .attr(
            "font-size",
            10.5
        )
        .attr(
            "fill",
            "#666"
        );

    legend.append("line")
        .attr("x1", 5)
        .attr("x2", 200)
        .attr("y1", 52)
        .attr("y2", 52)
        .attr(
            "stroke",
            "#ddd"
        );

    const addLegendText = (
        text,
        x,
        y,
        size = 12.5
    ) =>
        legend.append("text")
            .text(text)
            .attr("x", x)
            .attr("y", y)
            .attr(
                "font-size",
                size
            )
            .attr(
                "font-weight",
                "600"
            );

    addLegendText(
        "District (Node Color)",
        5,
        78
    );

    districts.forEach(
        (district, i) => {

            const y =
                102 + i * 21;

            legend.append("circle")
                .attr(
                    "cx",
                    12
                )
                .attr(
                    "cy",
                    y
                )
                .attr(
                    "r",
                    6
                )
                .attr(
                    "fill",
                    districtColorScale(
                        district
                    )
                );

            legend.append("text")
                .attr(
                    "x",
                    27
                )
                .attr(
                    "y",
                    y + 4
                )
                .text(district)
                .attr(
                    "font-size",
                    11
                );
        }
    );

    const stationLegendY = 222;

    addLegendText(
        "Station Type (Node Shape)",
        5,
        stationLegendY
    );

    [
        "Local",
        "Transfer",
        "Terminal"
    ].forEach(
        (type, i) => {

            const y =
                stationLegendY +
                25 +
                i * 24;

            if (
                type ===
                "Local"
            ) {

                legend.append(
                    "circle"
                )
                    .attr(
                        "cx",
                        12
                    )
                    .attr(
                        "cy",
                        y
                    )
                    .attr(
                        "r",
                        6
                    )
                    .attr(
                        "fill",
                        "white"
                    )
                    .attr(
                        "stroke",
                        "#333"
                    )
                    .attr(
                        "stroke-width",
                        1.5
                    );

            } else if (
                type ===
                "Transfer"
            ) {

                legend.append(
                    "path"
                )
                    .attr(
                        "d",
                        `M 12 ${y - 7} L 19 ${y} L 12 ${y + 7} L 5 ${y} Z`
                    )
                    .attr(
                        "fill",
                        "white"
                    )
                    .attr(
                        "stroke",
                        "#333"
                    )
                    .attr(
                        "stroke-width",
                        1.5
                    );

            } else {

                legend.append(
                    "rect"
                )
                    .attr(
                        "x",
                        6
                    )
                    .attr(
                        "y",
                        y - 6
                    )
                    .attr(
                        "width",
                        12
                    )
                    .attr(
                        "height",
                        12
                    )
                    .attr(
                        "fill",
                        "white"
                    )
                    .attr(
                        "stroke",
                        "#333"
                    )
                    .attr(
                        "stroke-width",
                        1.5
                    );
            }

            legend.append("text")
                .attr(
                    "x",
                    28
                )
                .attr(
                    "y",
                    y + 4
                )
                .text(type)
                .attr(
                    "font-size",
                    11
                );
        }
    );

    const passengerLegendY = 333;

    addLegendText(
        "Daily Passengers (Node Size)",
        5,
        passengerLegendY
    );

    [
        {
            label: "Low (< 4,000)",
            radius: 6
        },
        {
            label:
                "Medium (4,000–7,000)",
            radius: 10
        },
        {
            label: "High (> 7,000)",
            radius: 14
        }
    ].forEach(
        (item, i) => {

            const y =
                passengerLegendY +
                27 +
                i * 31;

            legend.append("circle")
                .attr(
                    "cx",
                    18
                )
                .attr(
                    "cy",
                    y
                )
                .attr(
                    "r",
                    item.radius
                )
                .attr(
                    "fill",
                    "#bdbdbd"
                )
                .attr(
                    "stroke",
                    "#444"
                );

            legend.append("text")
                .attr(
                    "x",
                    40
                )
                .attr(
                    "y",
                    y + 4
                )
                .text(
                    item.label
                )
                .attr(
                    "font-size",
                    10.5
                );
        }
    );

    const routeLegendY = 466;

    addLegendText(
        "Route Type (Link Pattern)",
        5,
        routeLegendY
    );

    routeTypes.forEach(
        (type, i) => {

            const y =
                routeLegendY +
                24 +
                i * 23;

            legend.append("line")
                .attr(
                    "x1",
                    5
                )
                .attr(
                    "x2",
                    58
                )
                .attr(
                    "y1",
                    y
                )
                .attr(
                    "y2",
                    y
                )
                .attr(
                    "stroke",
                    "#506070"
                )
                .attr(
                    "stroke-width",
                    2.5
                )
                .attr(
                    "stroke-dasharray",
                    routePatternScale(
                        type
                    )
                )
                .attr(
                    "stroke-linecap",
                    "round"
                );

            legend.append("text")
                .attr(
                    "x",
                    70
                )
                .attr(
                    "y",
                    y + 4
                )
                .text(type)
                .attr(
                    "font-size",
                    10.5
                );
        }
    );

    const travelLegendY = 568;

    addLegendText(
        "Travel Time (Link Thickness)",
        5,
        travelLegendY
    );

    travelIntervals.forEach(
        (item, i) => {

            const y =
                travelLegendY +
                25 +
                i * 23;

            legend.append("line")
                .attr(
                    "x1",
                    5
                )
                .attr(
                    "x2",
                    58
                )
                .attr(
                    "y1",
                    y
                )
                .attr(
                    "y2",
                    y
                )
                .attr(
                    "stroke",
                    "#555"
                )
                .attr(
                    "stroke-width",
                    item.width
                )
                .attr(
                    "stroke-linecap",
                    "round"
                );

            legend.append("text")
                .attr(
                    "x",
                    70
                )
                .attr(
                    "y",
                    y + 4
                )
                .text(
                    item.label
                )
                .attr(
                    "font-size",
                    10.5
                );
        }
    );

}).catch(error =>
    console.error(
        "Error loading the transit network data:",
        error
    )
);