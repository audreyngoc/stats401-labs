const geoJSONPath = "../data/world.geojson";
const gdpCSVPath = "../data/lab9_gdp_2025_top50.csv";
const topoJSONPath =
    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const NO_DATA = "#edf0f3";

const GDP_COLOR = d3.scaleSequentialLog()
    .domain([300, 31000])
    .interpolator(d3.interpolateRgb("#deebf7", "#084594"));

const formatGDP = d3.format(",.3f");
const tooltip = d3.select("#tooltip");

const numericToISO3 = {
    "004":"AFG","008":"ALB","012":"DZA","024":"AGO","032":"ARG",
    "036":"AUS","040":"AUT","050":"BGD","056":"BEL","076":"BRA",
    "100":"BGR","124":"CAN","152":"CHL","156":"CHN","158":"TWN",
    "170":"COL","191":"HRV","196":"CYP","203":"CZE","208":"DNK",
    "218":"ECU","233":"EST","246":"FIN","250":"FRA","268":"GEO",
    "276":"DEU","300":"GRC","344":"HKG","348":"HUN","356":"IND",
    "360":"IDN","364":"IRN","372":"IRL","376":"ISR","380":"ITA",
    "392":"JPN","398":"KAZ","410":"KOR","414":"KWT","417":"KGZ",
    "422":"LBN","428":"LVA","434":"LBY","440":"LTU","458":"MYS",
    "484":"MEX","496":"MNG","504":"MAR","528":"NLD","554":"NZL",
    "578":"NOR","586":"PAK","608":"PHL","616":"POL","620":"PRT",
    "642":"ROU","643":"RUS","682":"SAU","702":"SGP","704":"VNM",
    "710":"ZAF","724":"ESP","752":"SWE","756":"CHE","764":"THA",
    "784":"ARE","792":"TUR","826":"GBR","840":"USA","818":"EGY"
};

let gdpByISO3 = new Map();
let choroplethCountries = null;
let cartogramCountries = null;

const aliases = {
    "united states of america": "USA",
    "united states": "USA",
    "china": "CHN",
    "korea, republic of": "KOR",
    "republic of korea": "KOR",
    "south korea": "KOR",
    "russian federation": "RUS",
    "russia": "RUS",
    "turkiye": "TUR",
    "türkiye": "TUR",
    "iran, islamic republic of": "IRN",
    "iran": "IRN",
    "viet nam": "VNM",
    "vietnam": "VNM",
    "taiwan": "TWN",
    "taiwan, province of china": "TWN",
    "hong kong": "HKG",
    "hong kong sar": "HKG",
    "czechia": "CZE",
    "czech republic": "CZE",
    "united kingdom": "GBR",
    "britain": "GBR",
    "brunei darussalam": "BRN",
    "egypt": "EGY",
    "united arab emirates": "ARE"
};

function normalizeName(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function resolveISO3(feature) {
    const p = feature.properties || {};

    const candidates = [
        p["ISO3166-1-Alpha-3"],
        p.ISO_A3,
        p.ISO_A3_EH,
        p.iso_a3,
        p.ISO3,
        p.ADM0_A3,
        p.GU_A3
    ];

    const codes = candidates
        .map(value => String(value || "").trim().toUpperCase())
        .filter(value => /^[A-Z]{3}$/.test(value));

    const matchingCode = codes.find(code => gdpByISO3.has(code));
    if (matchingCode) return matchingCode;

    if (codes.length) return codes[0];

    const names = [
        p.ADMIN, p.NAME, p.name, p.NAME_EN, p.NAME_LONG
    ];

    for (const value of names) {
        const name = normalizeName(value);

        if (aliases[name]) return aliases[name];

        for (const [iso3, record] of gdpByISO3) {
            if (normalizeName(record.country) === name) {
                return iso3;
            }
        }
    }

    return "";
}

function getCartogramISO3(feature) {
    const iso3 = feature?.properties?.iso3;

    if (iso3) {
        return iso3;
    }

    const id = String(feature?.id ?? "").padStart(3, "0");
    return numericToISO3[id] || "";
}

function getCountryName(feature, record) {
    const p = feature.properties || {};

    return record?.country ||
        p.ADMIN ||
        p.NAME ||
        p.name ||
        p.NAME_LONG ||
        "Unknown country";
}

function tooltipHTML(name, record) {
    if (!record) {
        return `
            <div class="tooltip-country">${name}</div>
            <div class="tooltip-missing">
                No GDP data in the provided top-50 dataset.
            </div>
        `;
    }

    return `
        <div class="tooltip-country">${name}</div>
        <div><span class="tooltip-label">2025 GDP:</span>
            $${formatGDP(record.gdp)} billion
        </div>
        <div><span class="tooltip-label">GDP rank:</span>
            #${record.rank}
        </div>
    `;
}

function showTooltip(event, feature, record) {
    tooltip
        .html(tooltipHTML(getCountryName(feature, record), record))
        .style("opacity", 1);

    positionTooltip(event);
}

function positionTooltip(event) {
    const node = tooltip.node();
    if (!node) return;

    const gap = 6;
    const margin = 8;

    tooltip.style("left", "0px").style("top", "0px");

    const rect = node.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    let x = event.clientX + gap;
    let y = event.clientY + gap;

    if (x + rect.width > vw - margin) {
        x = event.clientX - rect.width - gap;
    }

    if (y + rect.height > vh - margin) {
        y = event.clientY - rect.height - gap;
    }

    x = Math.max(margin, Math.min(x, vw - rect.width - margin));
    y = Math.max(margin, Math.min(y, vh - rect.height - margin));

    tooltip.style("left", `${x}px`).style("top", `${y}px`);
}

function hideTooltip() {
    tooltip.style("opacity", 0);
}

function setCountryHighlight(iso3, active) {
    if (!iso3) return;

    if (choroplethCountries) {
        choroplethCountries.classed("highlighted", d =>
            active && d.properties.iso3 === iso3
        );
    }

    if (cartogramCountries) {
        cartogramCountries.classed("highlighted", d =>
            active && getCartogramISO3(d) === iso3
        );
    }
}


async function initialize() {
    try {
        const [geoData, csvData, topoData] = await Promise.all([
            d3.json(geoJSONPath),
            d3.csv(gdpCSVPath),
        ]);

        // Inspect the raw CSV before parsing its values.
        console.log("Raw GDP CSV rows:", csvData.length);
        console.log("Raw GDP CSV columns:", csvData.columns);
        console.log("First raw GDP row:", csvData[0]);

        if (!Array.isArray(csvData) || csvData.length === 0) {
            throw new Error(
                `The GDP CSV is empty or could not be parsed: ${gdpCSVPath}`
            );
        }

        // Normalize column names to handle BOMs, spaces, and capitalization.
        function normalizeRow(row) {
            const normalized = {};

            for (const [key, value] of Object.entries(row)) {
                const normalizedKey = key
                    .replace(/^\uFEFF/, "")
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "");

                normalized[normalizedKey] =
                    String(value ?? "").trim();
            }

            return normalized;
        }

        // Parse numeric fields even if values contain commas or currency symbols.
        function parseNumber(value) {
            const cleaned = String(value ?? "")
                .replace(/[$,\s]/g, "");

            if (!cleaned) return NaN;

            return Number(cleaned);
        }

        const parsedRows = csvData.map((row, index) => {
            const d = normalizeRow(row);

            const record = {
                iso3: (d.iso3 || "").toUpperCase(),
                country: d.country || "",
                gdp: parseNumber(d.gdp2025billionusd),
                rank: parseNumber(d.rank),
                sourceRow: index + 2
            };

            const errors = [];

            if (!/^[A-Z]{3}$/.test(record.iso3)) {
                errors.push("invalid ISO-3 identifier");
            }

            if (!record.country) {
                errors.push("missing country name");
            }

            if (!Number.isFinite(record.gdp) || record.gdp <= 0) {
                errors.push("invalid GDP value");
            }

            if (!Number.isFinite(record.rank) || record.rank <= 0) {
                errors.push("invalid rank");
            }

            return {
                record,
                errors
            };
        });

        const validRows = parsedRows.filter(
            item => item.errors.length === 0
        );

        const rejectedRows = parsedRows.filter(
            item => item.errors.length > 0
        );

        if (rejectedRows.length > 0) {
            console.error(
                "Rejected GDP rows:",
                rejectedRows.map(item => ({
                    row: item.record.sourceRow,
                    iso3: item.record.iso3,
                    country: item.record.country,
                    gdp: item.record.gdp,
                    rank: item.record.rank,
                    reasons: item.errors
                }))
            );
        }

        const gdpData = validRows.map(item => ({
            iso3: item.record.iso3,
            country: item.record.country,
            gdp: item.record.gdp,
            rank: item.record.rank
        }));

        // Verify the data before building either visualization.
        const uniqueCodes = new Set(gdpData.map(d => d.iso3));

        console.log("Valid GDP records:", gdpData.length);
        console.log("Unique ISO-3 codes:", uniqueCodes.size);
        console.log("GDP sample:", gdpData.slice(0, 3));

        if (gdpData.length === 0) {
            throw new Error(
                "No valid GDP records were loaded. Check the CSV headers " +
                "and the rejected-row details above."
            );
        }

        if (uniqueCodes.size !== gdpData.length) {
            throw new Error(
                "Duplicate ISO-3 codes detected in the GDP CSV."
            );
        }

        if (gdpData.length !== 50) {
            console.warn(
                `Expected 50 GDP records, but loaded ${gdpData.length}.`
            );
        }

        gdpByISO3 = new Map(
            gdpData.map(d => [d.iso3, d])
        );

        // Scale the colors to the actual values in the loaded dataset.
        GDP_COLOR.domain([
            d3.min(gdpData, d => d.gdp),
            d3.max(gdpData, d => d.gdp)
        ]);

        // Join GDP records to the GeoJSON using ISO-3 identifiers.
        geoData.features.forEach(feature => {
            const iso3 = resolveISO3(feature);

            feature.properties.iso3 = iso3;
            feature.properties.gdpData =
                gdpByISO3.get(iso3) || null;
        });

        const matched = new Set(
            geoData.features
                .map(feature => feature.properties.iso3)
                .filter(iso3 => gdpByISO3.has(iso3))
        );

        console.log(
            "Economies matched to GeoJSON:",
            matched.size
        );

        console.log(
            "Vietnam:",
            gdpByISO3.get("VNM")
        );

        console.log(
            "Unmatched GDP identifiers:",
            gdpData
                .filter(d => !matched.has(d.iso3))
                .map(d => d.iso3)
        );

        // Render the two views independently so one failure
        // does not prevent the other from appearing.
        try {
            drawChoropleth(geoData);
        } catch (error) {
            console.error(
                "Choropleth rendering failed:",
                error
            );

            d3.select("#choropleth")
                .append("p")
                .attr("class", "error-message")
                .text(
                    "The choropleth failed to render. Check the console."
                );
        }

        try {
            drawCartogram(geoData);
        } catch (error) {
            console.error(
                "Cartogram rendering failed:",
                error
            );

            d3.select("#cartogram")
                .append("p")
                .attr("class", "error-message")
                .text(
                    "The cartogram failed to render. Check the console."
                );
        }
    } catch (error) {
        console.error("Lab 9 loading error:", error);

        ["choropleth", "cartogram"].forEach(id => {
            d3.select(`#${id}`)
                .html("")
                .append("p")
                .attr("class", "error-message")
                .text(
                    "The visualization could not load. Check the console."
                );
        });
    }
}


function drawChoropleth(geoData) {
    const container = d3.select("#choropleth");
    container.html("");

    const width = 1000;
    const height = 540;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-label", "World choropleth of 2025 nominal GDP");

    const projection = d3.geoNaturalEarth1()
        .fitExtent([[8, 12], [width - 8, height - 12]], geoData);

    const path = d3.geoPath().projection(projection);
    const mapGroup = svg.append("g").attr("class", "map-group");

    choroplethCountries = mapGroup
        .selectAll("path")
        .data(geoData.features)
        .join("path")
        .attr("class", "lab9-country")
        .attr("d", path)
        .attr("fill", d => {
            const record = d.properties.gdpData;
            return record ? GDP_COLOR(record.gdp) : NO_DATA;
        })
        .attr("vector-effect", "non-scaling-stroke")
        .on("pointerenter", function(event, feature) {
            setCountryHighlight(feature.properties.iso3, true);
            showTooltip(event, feature, feature.properties.gdpData);
        })
        .on("pointermove", positionTooltip)
        .on("pointerleave", function(event, feature) {
            setCountryHighlight(feature.properties.iso3, false);
            hideTooltip();
        });

    svg.call(
        d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", event => mapGroup.attr("transform", event.transform))
    ).on("dblclick.zoom", null);

    drawGDPLegend();
}


function drawGDPLegend() {
    const container = d3.select("#choropleth-legend");
    container.html("");

    const width = 680;
    const height = 96;
    const left = 12;
    const right = width - 12;
    const barY = 27;
    const barHeight = 12;

    const [minGDP, maxGDP] = GDP_COLOR.domain();

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("role", "img")
        .attr("aria-label", "Logarithmic 2025 GDP color legend");

    svg.append("text")
        .attr("x", left)
        .attr("y", 12)
        .attr("fill", "#344256")
        .attr("font-size", 11)
        .attr("font-weight", 600)
        .text("2025 nominal GDP (billion USD)");

    const gradientId = "lab9-gdp-gradient";

    const gradient = svg.append("defs")
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%");

    d3.range(0, 1.001, 0.025).forEach(t => {
        const value = Math.exp(
            Math.log(minGDP) +
            t * (Math.log(maxGDP) - Math.log(minGDP))
        );

        gradient.append("stop")
            .attr("offset", `${t * 100}%`)
            .attr("stop-color", GDP_COLOR(value));
    });

    svg.append("rect")
        .attr("x", left)
        .attr("y", barY)
        .attr("width", right - left)
        .attr("height", barHeight)
        .attr("rx", 3)
        .attr("fill", `url(#${gradientId})`);

    const scale = d3.scaleLog()
        .domain([minGDP, maxGDP])
        .range([left, right]);

    // Keep the endpoints and useful reference values.
    // Remove ticks that would produce overlapping labels.
    const candidates = [
        minGDP,
        500,
        1000,
        5000,
        10000,
        maxGDP
    ]
        .filter((value, i, arr) =>
            value >= minGDP &&
            value <= maxGDP &&
            arr.indexOf(value) === i
        )
        .sort((a, b) => a - b);

    const ticks = [];

    candidates.forEach(value => {
        const x = scale(value);
        const isEndpoint =
            value === minGDP || value === maxGDP;

        if (
            isEndpoint ||
            ticks.every(tick => Math.abs(scale(tick) - x) >= 62)
        ) {
            ticks.push(value);
        }
    });

    // Always retain the maximum, even when near another tick.
    if (ticks[ticks.length - 1] !== maxGDP) {
        while (
            ticks.length > 1 &&
            scale(maxGDP) - scale(ticks[ticks.length - 2]) < 62
        ) {
            ticks.pop();
        }

        ticks.push(maxGDP);
    }

    function formatTick(value) {
        if (value < 1000) {
            return d3.format(",.0f")(value);
        }

        if (value < 10000) {
            return `${(value / 1000).toFixed(0)}k`;
        }

        return `${(value / 1000).toFixed(1)}k`;
    }

    ticks.forEach((value, i) => {
        const x = scale(value);

        svg.append("line")
            .attr("x1", x)
            .attr("x2", x)
            .attr("y1", barY + barHeight)
            .attr("y2", barY + barHeight + 4)
            .attr("stroke", "#8290a2")
            .attr("stroke-width", 0.8);

        svg.append("text")
            .attr("x", x)
            .attr("y", barY + barHeight + 16)
            .attr("fill", "#566579")
            .attr("font-size", 10)
            .attr("text-anchor",
                i === 0 ? "start" :
                i === ticks.length - 1 ? "end" :
                "middle"
            )
            .text(formatTick(value));
    });

    // Missing-data key.
    svg.append("rect")
        .attr("x", left)
        .attr("y", 76)
        .attr("width", 10)
        .attr("height", 10)
        .attr("rx", 2)
        .attr("fill", NO_DATA)
        .attr("stroke", "#cbd2da");

    svg.append("text")
        .attr("x", left + 17)
        .attr("y", 84)
        .attr("fill", "#64748b")
        .attr("font-size", 10)
        .text("No data in provided top-50 dataset");
}


function drawCartogram() {
    const container = d3.select("#cartogram");
    container.html("");

    if (typeof Cartogram !== "function") {
        container.append("p")
            .attr("class", "error-message")
            .text("The cartogram library failed to load.");
        return;
    }

    const topologyURL =
        "https://cdn.jsdelivr.net/npm/cartogram-chart@1.4.4/example/world-gdp/ne_110m_admin_0_countries.json";

    d3.json(topologyURL)
        .then(topology => {
            if (!topology?.objects?.countries?.geometries) {
                throw new Error(
                    "The topology does not contain countries.geometries."
                );
            }

            // Work on a copy of the original topology.
            const topoData = structuredClone(topology);
            const geometries =
                topoData.objects.countries.geometries;

            // Resolve country identifiers.
            geometries.forEach(feature => {
                feature.properties = feature.properties || {};
                feature.properties.iso3 = resolveISO3(feature);
            });

            // Exclude Antarctica.
            topoData.objects.countries.geometries =
                geometries.filter(feature => {
                    const p = feature.properties || {};

                    return (
                        p.ISO_A2 !== "AQ" &&
                        p.ADMIN !== "Antarctica" &&
                        p.NAME !== "Antarctica"
                    );
                });

            // Use a technical reference value for countries without
            // GDP data. These countries remain gray in the display.
            const gdpValues = [...gdpByISO3.values()]
                .map(d => d.gdp)
                .sort((a, b) => a - b);

            const medianGDP = d3.quantile(gdpValues, 0.5) || 1;

            const cartogram = new Cartogram(container.node());

            cartogram
                .width(1000)
                .height(560)
                .topoJson(topoData)
                .topoObjectName("countries")
                .projection(d3.geoNaturalEarth1())
                .iterations(15)

                .value(feature => {
                    const iso3 = getCartogramISO3(feature);
                    const record = gdpByISO3.get(iso3);

                    return record ? record.gdp : medianGDP;
                })

                .color(feature => {
                    const iso3 = getCartogramISO3(feature);
                    const record = gdpByISO3.get(iso3);

                    return record
                        ? GDP_COLOR(record.gdp)
                        : NO_DATA;
                })

                .label(feature => {
                    const iso3 = getCartogramISO3(feature);
                    const record = gdpByISO3.get(iso3);

                    return getCountryName(feature, record);
                })

                .valFormatter(value =>
                    d3.format(",.1f")(value)
                )

                .units("billion USD")

                // Disable the library's tooltip content.
                .tooltipContent(() => "");

            // Hide/remove tooltip elements created by the library,
            // while preserving the shared custom #tooltip element.
            container
                .selectAll(
                    ".tooltip, .cartogram-tooltip, .chart-tooltip"
                )
                .remove();

            // Wait until the cartogram paths have been created.
            function attachHoverInteractions(attempt = 0) {
                const paths = container.selectAll("path");

                if (paths.empty()) {
                    if (attempt < 30) {
                        requestAnimationFrame(() =>
                            attachHoverInteractions(attempt + 1)
                        );
                    } else {
                        console.warn(
                            "Cartogram paths were not found."
                        );
                    }

                    return;
                }

                cartogramCountries = paths
                    .classed("lab9-cartogram-country", true)
                    .style("cursor", "pointer")
                    .attr("pointer-events", "all");

                // Remove existing mouse/pointer handlers to prevent
                // duplicate tooltip behavior.
                cartogramCountries
                    .on(".lab9", null)
                    .on("mouseenter", null)
                    .on("mousemove", null)
                    .on("mouseleave", null)
                    .on("mouseover", null)
                    .on("mouseout", null)
                    .on("pointerenter", null)
                    .on("pointermove", null)
                    .on("pointerleave", null);

                // Use one consistent set of pointer handlers.
                cartogramCountries
                    .on("pointerenter.lab9", function(event, feature) {
                        const iso3 = getCartogramISO3(feature);
                        const record = gdpByISO3.get(iso3);

                        setCountryHighlight(iso3, true);
                        showTooltip(event, feature, record);
                    })

                    .on("pointermove.lab9", function(event) {
                        positionTooltip(event);
                    })

                    .on("pointerleave.lab9", function(event, feature) {
                        const iso3 = getCartogramISO3(feature);

                        setCountryHighlight(iso3, false);
                        hideTooltip();
                    });
            }

            attachHoverInteractions();
        })
        .catch(error => {
            console.error("Cartogram rendering failed:", error);

            container.html("")
                .append("p")
                .attr("class", "error-message")
                .text(
                    "The cartogram could not be rendered. " +
                    "Check the browser console for details."
                );
        });
}


function setupCartogramInteractions() {
    const container = d3.select("#cartogram");
    cartogramCountries = container.selectAll("path");

    if (cartogramCountries.empty()) {
        console.warn("Cartogram paths were not found.");
        return;
    }

    cartogramCountries
        .classed("lab9-cartogram-country", true)
        .attr("vector-effect", "non-scaling-stroke")
        .on("pointerenter.lab9", function(event, feature) {
            const iso3 = getCartogramISO3(feature);
            const record = gdpByISO3.get(iso3);

            setCountryHighlight(iso3, true);
            showTooltip(event, feature, record);
        })
        .on("pointermove.lab9", positionTooltip)
        .on("pointerleave.lab9", function(event, feature) {
            setCountryHighlight(getCartogramISO3(feature), false);
            hideTooltip();
        });
}

initialize();