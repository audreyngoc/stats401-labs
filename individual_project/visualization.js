const container = d3.select("#visualization");
const countrySelect = d3.select("#country-select");
const globalToggle = d3.select("#global-toggle");
const playButton = d3.select("#play-button");
const resetButton = d3.select("#reset-button");
const dateSelect = d3.select("#date-select");
const checkboxContainer = d3.select("#country-checkboxes");
const selectAllButton = d3.select("#select-all-countries");
const highlightControl = d3.select("#highlight-control");
const comparisonControls = d3.select("#comparison-controls");

const countryColors = {
    "China": "#ec6803",
    "France": "#76c5f3",
    "Germany": "#b580ed",
    "Italy": "#55ffd2",
    "Spain": "#f7c653ea",
    "United Kingdom": "#ff80c6",
    "United States": "#7cf669"
};

const countryOrder = [
    "China",
    "France",
    "Germany",
    "Italy",
    "Spain",
    "United Kingdom",
    "United States"
];

const parseDate = d3.timeParse("%Y-%m-%d");
const formatDate = d3.timeFormat("%b %d, %Y");
const formatAxisDate = d3.timeFormat("%b %d");

const numberFormat = d3.format(",.1f");
const rateFormat = d3.format("+.2f");

let data = [];
let selectedCountry = "all";

let comparisonCountries = [
    "China",
    "France",
    "Germany",
    "Italy",
    "Spain",
    "United Kingdom",
    "United States"
];

let globalMode = false;

let animationTimer = null;
let animationIndex = 0;
let animationPlaying = false;

let availableDates = [];
let currentDateIndex = 0;

const previousViewCountries = new Set();


d3.csv("data/covid_mortality.csv").then(raw => {

    data = raw.map(d => ({
        country: d.country,
        date: parseDate(d.date),
        newDeaths: +d.new_deaths,
        avgDeaths: +d.avg_deaths,
        rateChange: +d.rate_change
    }));

        availableDates = Array.from(
        d3.group(
            data,
            d => +d.date
        ).values()
    )
        .map(values => values[0].date)
        .sort((a, b) => a - b);


    if (availableDates.length) {

        dateSelect
            .attr(
                "min",
                formatDateInput(
                    availableDates[0]
                )
            )
            .attr(
                "max",
                formatDateInput(
                    availableDates[
                        availableDates.length - 1
                    ]
                )
            )
            .property(
                "value",
                formatDateInput(
                    availableDates[0]
                )
            );
    }

    setupCountryControls();
    setupButtons();

    updateModeControls();

    render();

    const observer = new ResizeObserver(() => {
        render();
    });

    observer.observe(
        document.querySelector("#visualization")
    );

}).catch(error => {

    console.error(
        "Could not load covid_mortality.csv:",
        error
    );

    container
        .append("p")
        .attr("class", "chart-error")
        .text(
            "The visualization data could not be loaded. Check the CSV path."
        );
});


function setupCountryControls() {

    countryOrder.forEach(country => {

        if (!data.some(d => d.country === country)) {
            return;
        }

        countrySelect
            .append("option")
            .attr("value", country)
            .text(country);


        const label = checkboxContainer
            .append("label")
            .attr("class", "country-check");


        label
            .append("input")
            .attr("type", "checkbox")
            .attr("value", country)
            .property(
                "checked",
                comparisonCountries.includes(country)
            );


        label
            .append("span")
            .style(
                "background",
                countryColors[country]
            );


        label
            .append("strong")
            .text(country);
    });


    checkboxContainer
        .selectAll("input")
        .on("change", function() {

            const country = this.value;

            if (this.checked) {

                if (!comparisonCountries.includes(country)) {
                    comparisonCountries.push(country);
                }

            } else {

                comparisonCountries =
                    comparisonCountries.filter(
                        d => d !== country
                    );
            }

            comparisonCountries =
                countryOrder.filter(
                    d =>
                        comparisonCountries.includes(d)
                );

            if (globalMode) {
                render();
            }
        });


    countrySelect.on("change", function() {

        selectedCountry = this.value;

        if (!globalMode) {
            render();
        }
    });


    selectAllButton.on("click", () => {

        comparisonCountries =
            [...countryOrder];

        checkboxContainer
            .selectAll("input")
            .property("checked", true);

        if (globalMode) {
            render();
        }
    });
}

function updateModeControls() {
    if (globalMode) {
        highlightControl.style("display", "none");
        comparisonControls.style("display", "block");
    } else {
        highlightControl.style("display", "flex");
        comparisonControls.style("display", "none");
    }
}

function setupButtons() {

    globalToggle.on("click", () => {

        globalMode = !globalMode;

        stopAnimation();

        globalToggle
            .classed("active", globalMode)
            .text(
                globalMode
                    ? "Each Country View"
                    : "Global Comparison View"
            );
        
        updateModeControls();

        render();
    });


    playButton.on("click", () => {

        if (animationPlaying) {
            stopAnimation();
        } else {
            startAnimation();
        }
    });


    resetButton.on("click", () => {

        stopAnimation();

        currentDateIndex = 0;
        animationIndex = 0;

        render();
    });

        dateSelect.on("change", function() {

        const selectedDate =
            parseDateInput(this.value);

        if (!selectedDate) {
            return;
        }


        const closestIndex =
            d3.bisector(
                d => d
            ).center(
                availableDates,
                selectedDate
            );


        currentDateIndex =
            Math.max(
                0,
                Math.min(
                    closestIndex,
                    availableDates.length - 1
                )
            );


        animationIndex =
            currentDateIndex;


        stopAnimation();

        render();
    });
}


function render() {

    container.selectAll("*").remove();

    if (!data.length) {
        return;
    }


    currentDateIndex =
        Math.max(
            0,
            Math.min(
                animationIndex,
                availableDates.length - 1
            )
        );


    updateDateControl();


    if (globalMode) {

        renderGlobalComparison();

    } else {

        renderSmallMultiples();
    }
}


function getScales() {

    const avgMax =
        d3.max(
            data,
            d =>
                Number.isFinite(d.avgDeaths)
                    ? d.avgDeaths
                    : 0
        ) || 1;


    const rateMax =
        d3.max(
            data,
            d =>
                Number.isFinite(d.rateChange)
                    ? Math.abs(d.rateChange)
                    : 0
        ) || 1;


    return {
        dateDomain: d3.extent(
            data,
            d => d.date
        ),

        avgDomain: [
            0,
            avgMax * 1.05
        ],

        rateDomain: [
            -rateMax * 1.05,
            rateMax * 1.05
        ]
    };
}


function renderSmallMultiples() {

    const countries =
        countryOrder.filter(
            country =>
                data.some(
                    d => d.country === country
                )
        );


    const grouped =
        d3.group(
            data,
            d => d.country
        );


    const scales = getScales();


    const width =
        container
            .node()
            .getBoundingClientRect()
            .width;


    const columns =
        width >= 1000 ? 2 : 1;


    const gap = 24;


    const panelWidth =
        (
            width -
            gap * (columns - 1)
        ) / columns;


    const panelHeight = 430;


    const margin = {
        top: 42,
        right: 24,
        bottom: 62,
        left: 78
    };


    const innerWidth =
        panelWidth -
        margin.left -
        margin.right;


    const trackHeight = 125;
    const trackGap = 48;


    const totalPanelHeight =
        margin.top +
        trackHeight +
        trackGap +
        trackHeight +
        margin.bottom;


    const rows =
        Math.ceil(
            countries.length / columns
        );


    const totalHeight =
        rows * totalPanelHeight +
        (rows - 1) * gap;


    const svg =
        container
            .append("svg")
            .attr(
                "viewBox",
                `0 0 ${width} ${totalHeight}`
            )
            .attr(
                "width",
                "100%"
            );


    countries.forEach(
        (country, index) => {

            const countryData =
                grouped.get(country) || [];


            drawCurrentPanel({
                svg,
                country,
                countryData,
                index,
                columns,
                gap,
                panelWidth,
                totalPanelHeight,
                innerWidth,
                trackHeight,
                trackGap,
                margin,
                scales
            });
        }
    );
}


function getPanelPosition(
    index,
    columns,
    gap,
    panelWidth,
    panelHeight
) {

    const row =
        Math.floor(index / columns);

    const column =
        index % columns;


    return {
        x:
            column *
            (panelWidth + gap),

        y:
            row *
            (panelHeight + gap)
    };
}


function drawCurrentPanel(config) {

    const {
        svg,
        country,
        countryData,
        index,
        columns,
        gap,
        panelWidth,
        totalPanelHeight,
        innerWidth,
        trackHeight,
        trackGap,
        margin,
        scales
    } = config;


    const position =
        getPanelPosition(
            index,
            columns,
            gap,
            panelWidth,
            totalPanelHeight
        );


    const panel =
        svg
            .append("g")
            .attr(
                "class",
                "country-panel"
            )
            .attr(
                "data-country",
                country
            )
            .attr(
                "transform",
                `translate(
                    ${position.x},
                    ${position.y}
                )`
            );


    if (
        selectedCountry !== "all" &&
        selectedCountry !== country
    ) {

        panel.attr(
            "opacity",
            0.22
        );
    }


    drawPanelBackground(
        panel,
        country,
        panelWidth,
        totalPanelHeight
    );


    addPanelHeader(
        panel,
        country,
        panelWidth
    );

    addPanelDate(
        panel,
        panelWidth
    );

    function addPanelDate(
        panel,
        width
    ) {

        const currentDate =
            getCurrentDate();


        panel
            .append("text")
            .attr(
                "class",
                "panel-date"
            )
            .attr(
                "x",
                width - 25
            )
            .attr(
                "y",
                18
            )
            .attr(
                "text-anchor",
                "end"
            )
            .text(
                currentDate
                    ? formatDate(
                        currentDate
                    )
                    : ""
            );
    }

    const x =
        d3.scaleTime()
            .domain(scales.dateDomain)
            .range([
                0,
                innerWidth
            ]);


    const yAvg =
        d3.scaleLinear()
            .domain(scales.avgDomain)
            .range([
                trackHeight,
                0
            ]);


    const yRate =
        d3.scaleLinear()
            .domain(scales.rateDomain)
            .range([
                trackHeight,
                0
            ]);


    const upper =
        panel
            .append("g")
            .attr(
                "transform",
                `translate(
                    ${margin.left},
                    ${margin.top}
                )`
            );


    const lower =
        panel
            .append("g")
            .attr(
                "transform",
                `translate(
                    ${margin.left},
                    ${margin.top +
                    trackHeight +
                    trackGap}
                )`
            );


    drawAxes({
        upper,
        lower,
        x,
        yAvg,
        yRate,
        innerWidth,
        trackHeight
    });


    const visibleData =
        getAnimatedData(
            countryData
        );


    drawCurrentLines({
        upper,
        lower,
        countryData: visibleData,
        x,
        yAvg,
        yRate,
        country
    });


    drawPoints({
        upper,
        lower,
        countryData: visibleData,
        x,
        yAvg,
        yRate,
        country
    });


    addHoverInteraction({
        panel,
        countryData,
        x,
        yAvg,
        yRate,
        upper,
        lower,
        margin,
        trackHeight
    });
}


function drawPanelBackground(
    panel,
    country,
    width,
    height
) {

    panel
        .append("rect")
        .attr(
            "class",
            "panel-background"
        )
        .attr(
            "width",
            width
        )
        .attr(
            "height",
            height
        )
        .attr(
            "rx",
            10
        )
        .attr(
            "fill",
            "#fffdf8"
        )
        .attr(
            "stroke",
            "#e5e0d7"
        )
        .attr(
            "stroke-width",
            1
        );
}


function addPanelHeader(
    panel,
    country,
    width
) {

    panel
        .append("line")
        .attr(
            "x1",
            16
        )
        .attr(
            "x2",
            44
        )
        .attr(
            "y1",
            22
        )
        .attr(
            "y2",
            22
        )
        .attr(
            "stroke",
            countryColors[country]
        )
        .attr(
            "stroke-width",
            3
        )
        .attr(
            "stroke-linecap",
            "round"
        );


    panel
        .append("text")
        .attr(
            "class",
            "country-title"
        )
        .attr(
            "x",
            54
        )
        .attr(
            "y",
            27
        )
        .text(country);
}


function drawCurrentLines({
    upper,
    lower,
    countryData,
    x,
    yAvg,
    yRate,
    country
}) {

    const avgLine =
        d3.line()
            .defined(
                d =>
                    Number.isFinite(
                        d.avgDeaths
                    )
            )
            .x(
                d => x(d.date)
            )
            .y(
                d =>
                    yAvg(
                        d.avgDeaths
                    )
            );


    const rateLine =
        d3.line()
            .defined(
                d =>
                    Number.isFinite(
                        d.rateChange
                    )
            )
            .x(
                d => x(d.date)
            )
            .y(
                d =>
                    yRate(
                        d.rateChange
                    )
            );


    upper
        .append("path")
        .datum(countryData)
        .attr(
            "class",
            "series-line"
        )
        .attr(
            "d",
            avgLine
        )
        .attr(
            "stroke",
            countryColors[country]
        )
        .attr(
            "fill",
            "none"
        )
        .attr(
            "stroke-width",
            2
        );


    lower
        .append("path")
        .datum(countryData)
        .attr(
            "class",
            "series-line"
        )
        .attr(
            "d",
            rateLine
        )
        .attr(
            "stroke",
            countryColors[country]
        )
        .attr(
            "fill",
            "none"
        )
        .attr(
            "stroke-width",
            2
        );
}


function drawAxes({
    upper,
    lower,
    x,
    yAvg,
    yRate,
    innerWidth,
    trackHeight
}) {

    upper
        .append("g")
        .attr(
            "class",
            "axis axis-y"
        )
        .call(
            d3.axisLeft(yAvg)
                .ticks(4)
        );


    lower
        .append("g")
        .attr(
            "class",
            "axis axis-y"
        )
        .call(
            d3.axisLeft(yRate)
                .ticks(5)
        );


    lower
        .append("g")
        .attr(
            "class",
            "axis axis-x"
        )
        .attr(
            "transform",
            `translate(
                0,
                ${trackHeight}
            )`
        )
        .call(
            d3.axisBottom(x)
                .ticks(5)
                .tickFormat(
                    formatAxisDate
                )
        );


    upper
        .append("text")
        .attr(
            "class",
            "axis-title axis-title-y"
        )
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -trackHeight / 2
        )
        .attr(
            "y",
            -58
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Avg. deaths / day"
        );


    lower
        .append("text")
        .attr(
            "class",
            "axis-title axis-title-y"
        )
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -trackHeight / 2
        )
        .attr(
            "y",
            -58
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Rate of change (deaths / day²)"
        );


    lower
        .append("text")
        .attr(
            "class",
            "axis-title"
        )
        .attr(
            "x",
            innerWidth / 2
        )
        .attr(
            "y",
            trackHeight + 48
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text("Date");


    upper
        .append("text")
        .attr(
            "class",
            "track-label"
        )
        .attr(
            "x",
            innerWidth
        )
        .attr(
            "y",
            -10
        )
        .attr(
            "text-anchor",
            "end"
        )
        .text(
            "Average deaths"
        );


    lower
        .append("text")
        .attr(
            "class",
            "track-label"
        )
        .attr(
            "x",
            innerWidth
        )
        .attr(
            "y",
            -10
        )
        .attr(
            "text-anchor",
            "end"
        )
        .text(
            "Rate of change (deaths / day²)"
        );
}


function drawPoints({
    upper,
    lower,
    countryData,
    x,
    yAvg,
    yRate,
    country
}) {

    upper
        .selectAll(".daily-point")
        .data(
            countryData.filter(
                d =>
                    Number.isFinite(
                        d.avgDeaths
                    )
            )
        )
        .enter()
        .append("circle")
        .attr(
            "class",
            "daily-point"
        )
        .attr(
            "cx",
            d => x(d.date)
        )
        .attr(
            "cy",
            d =>
                yAvg(
                    d.avgDeaths
                )
        )
        .attr(
            "r",
            1.7
        )
        .attr(
            "fill",
            countryColors[country]
        )
        .attr(
            "opacity",
            0.4
        );


    lower
        .selectAll(".daily-point")
        .data(
            countryData.filter(
                d =>
                    Number.isFinite(
                        d.rateChange
                    )
            )
        )
        .enter()
        .append("circle")
        .attr(
            "class",
            "daily-point"
        )
        .attr(
            "cx",
            d => x(d.date)
        )
        .attr(
            "cy",
            d =>
                yRate(
                    d.rateChange
                )
        )
        .attr(
            "r",
            1.7
        )
        .attr(
            "fill",
            countryColors[country]
        )
        .attr(
            "opacity",
            0.4
        );
}

function getNearestDateFromData(
    date,
    countryData
) {

    const dates =
        countryData
            .map(d => d.date)
            .filter(
                d => d instanceof Date &&
                     !isNaN(d)
            )
            .sort(
                (a, b) => a - b
            );

    if (!dates.length) {
        return null;
    }

    const index =
        d3.bisector(
            d => d
        ).center(
            dates,
            date
        );

    return dates[
        Math.max(
            0,
            Math.min(
                index,
                dates.length - 1
            )
        )
    ];
}

function addHoverInteraction({
    panel,
    countryData,
    x,
    yAvg,
    yRate,
    upper,
    lower,
    margin,
    trackHeight
}) {

    const country =
        panel.attr("data-country");

    const crosshairUpper =
        upper
            .append("line")
            .attr("class", "crosshair")
            .attr("y1", 0)
            .attr("y2", trackHeight)
            .attr("display", "none");

    const crosshairLower =
        lower
            .append("line")
            .attr("class", "crosshair")
            .attr("y1", 0)
            .attr("y2", trackHeight)
            .attr("display", "none");

    const activeAvg =
        upper
            .append("circle")
            .attr("class", "active-point")
            .attr("r", 5)
            .attr("fill", countryColors[country])
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("display", "none");

    const activeRate =
        lower
            .append("circle")
            .attr("class", "active-point")
            .attr("r", 5)
            .attr("fill", countryColors[country])
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("display", "none");

    const interaction =
        panel
            .append("rect")
            .attr("class", "interaction-layer")
            .attr("x", margin.left)
            .attr("y", margin.top)
            .attr("width", x.range()[1])
            .attr("height", trackHeight * 2 + 48)
            .attr("fill", "transparent");

    interaction.on("mousemove", function(event) {

        const [panelX] = d3.pointer(
            event,
            panel.node()
        );

        const mouseX = panelX - margin.left;

        const clampedX = Math.max(
            0,
            Math.min(
                x.range()[1],
                mouseX
            )
        );

        const hoveredDate = x.invert(clampedX);

        /*
         * IMPORTANT:
         * Find the nearest date from THIS COUNTRY'S
         * data instead of the global availableDates.
         */
        const activeDate =
            getNearestDateFromData(
                hoveredDate,
                countryData
            );

        if (!activeDate) {
            hideTooltip();
            return;
        }

        const point =
            countryData.find(
                d =>
                    +d.date === +activeDate
            );

        if (!point) {
            hideTooltip();
            return;
        }

        const xpos =
            x(activeDate);

        /*
         * Keep the crosshair exactly aligned
         * with the selected date on the x-axis.
         */
        crosshairUpper
            .attr("x1", xpos)
            .attr("x2", xpos)
            .attr("display", null);

        crosshairLower
            .attr("x1", xpos)
            .attr("x2", xpos)
            .attr("display", null);

        if (
            Number.isFinite(point.avgDeaths)
        ) {

            activeAvg
                .attr("cx", xpos)
                .attr(
                    "cy",
                    yAvg(point.avgDeaths)
                )
                .attr("display", null);

        } else {

            activeAvg
                .attr(
                    "display",
                    "none"
                );
        }

        if (
            Number.isFinite(point.rateChange)
        ) {

            activeRate
                .attr("cx", xpos)
                .attr(
                    "cy",
                    yRate(point.rateChange)
                )
                .attr("display", null);

        } else {

            activeRate
                .attr(
                    "display",
                    "none"
                );
        }

        showTooltip(
            event,
            country,
            point
        );
    });

    interaction.on(
        "mouseleave",
        () => {

            crosshairUpper
                .attr(
                    "display",
                    "none"
                );

            crosshairLower
                .attr(
                    "display",
                    "none"
                );

            activeAvg
                .attr(
                    "display",
                    "none"
                );

            activeRate
                .attr(
                    "display",
                    "none"
                );

            hideTooltip();
        }
    );
}

function drawPreviousPanel(config) {

    const {
        svg,
        country,
        countryData,
        index,
        columns,
        gap,
        panelWidth,
        totalPanelHeight,
        margin,
        scales
    } = config;


    const position =
        getPanelPosition(
            index,
            columns,
            gap,
            panelWidth,
            totalPanelHeight
        );


    const panel =
        svg
            .append("g")
            .attr(
                "class",
                "country-panel previous-panel"
            )
            .attr(
                "data-country",
                country
            )
            .attr(
                "transform",
                `translate(
                    ${position.x},
                    ${position.y}
                )`
            );


    if (
        selectedCountry !== "all" &&
        selectedCountry !== country
    ) {

        panel.attr(
            "opacity",
            0.22
        );
    }


    drawPanelBackground(
        panel,
        country,
        panelWidth,
        totalPanelHeight
    );


    addPanelHeader(
        panel,
        country,
        panelWidth
    );


    panel
        .append("text")
        .attr(
            "class",
            "previous-label"
        )
        .attr(
            "x",
            panelWidth - 20
        )
        .attr(
            "y",
            55
        )
        .attr(
            "text-anchor",
            "end"
        )
        .text(
            "PREVIOUS VERSION"
        );


    const chartMargin = {
        top: 70,
        right: 30,
        bottom: 55,
        left: 65
    };


    const width =
        panelWidth -
        chartMargin.left -
        chartMargin.right;


    const height =
        totalPanelHeight -
        chartMargin.top -
        chartMargin.bottom;


    const x =
        d3.scaleLinear()
            .domain(
                scales.rateDomain
            )
            .range([
                0,
                width
            ]);


    const y =
        d3.scaleLinear()
            .domain(
                scales.avgDomain
            )
            .range([
                height,
                0
            ]);


    const chart =
        panel
            .append("g")
            .attr(
                "transform",
                `translate(
                    ${chartMargin.left},
                    ${chartMargin.top}
                )`
            );


    chart
        .append("g")
        .attr(
            "class",
            "axis axis-y"
        )
        .call(
            d3.axisLeft(y)
                .ticks(5)
        );


    chart
        .append("g")
        .attr(
            "class",
            "axis axis-x"
        )
        .attr(
            "transform",
            `translate(
                0,
                ${height}
            )`
        )
        .call(
            d3.axisBottom(x)
                .ticks(5)
        );


    chart
        .append("text")
        .attr(
            "class",
            "axis-title"
        )
        .attr(
            "x",
            width / 2
        )
        .attr(
            "y",
            height + 42
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Rate of change (deaths / day²)"
        );


    chart
        .append("text")
        .attr(
            "class",
            "axis-title axis-title-y"
        )
        .attr(
            "transform",
            "rotate(-90)"
        )
        .attr(
            "x",
            -height / 2
        )
        .attr(
            "y",
            -48
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Avg. deaths / day"
        );


    const visibleData =
        getAnimatedData(
            countryData
        );


    const line =
        d3.line()
            .defined(
                d =>
                    Number.isFinite(
                        d.avgDeaths
                    ) &&
                    Number.isFinite(
                        d.rateChange
                    )
            )
            .x(
                d =>
                    x(d.rateChange)
            )
            .y(
                d =>
                    y(d.avgDeaths)
            );


    chart
        .append("path")
        .datum(visibleData)
        .attr(
            "class",
            "series-line"
        )
        .attr(
            "d",
            line
        )
        .attr(
            "stroke",
            countryColors[country]
        )
        .attr(
            "fill",
            "none"
        )
        .attr(
            "stroke-width",
            2.5
        );


    chart
        .selectAll(
            ".previous-point"
        )
        .data(
            visibleData.filter(
                d =>
                    Number.isFinite(
                        d.avgDeaths
                    ) &&
                    Number.isFinite(
                        d.rateChange
                    )
            )
        )
        .enter()
        .append("circle")
        .attr(
            "class",
            "previous-point"
        )
        .attr(
            "cx",
            d =>
                x(d.rateChange)
        )
        .attr(
            "cy",
            d =>
                y(d.avgDeaths)
        )
        .attr(
            "r",
            1.8
        )
        .attr(
            "fill",
            countryColors[country]
        )
        .attr(
            "opacity",
            0.45
        );


    const interaction =
        panel
            .append("rect")
            .attr(
                "class",
                "interaction-layer"
            )
            .attr(
                "x",
                chartMargin.left
            )
            .attr(
                "y",
                chartMargin.top
            )
            .attr(
                "width",
                width
            )
            .attr(
                "height",
                height
            )
            .attr(
                "fill",
                "transparent"
            );


    interaction.on(
        "mousemove",
        function(event) {

            const [
                mouseX,
                mouseY
            ] = d3.pointer(
                event,
                this
            );


            const rate =
                x.invert(mouseX);

            const avg =
                y.invert(mouseY);


            const nearest =
                countryData.reduce(
                    (best, current) => {

                        if (
                            !Number.isFinite(
                                current.rateChange
                            ) ||
                            !Number.isFinite(
                                current.avgDeaths
                            )
                        ) {
                            return best;
                        }

                        const distance =
                            Math.pow(
                                current.rateChange -
                                rate,
                                2
                            ) +
                            Math.pow(
                                current.avgDeaths -
                                avg,
                                2
                            );

                        if (
                            !best ||
                            distance < best.distance
                        ) {
                            return {
                                point: current,
                                distance
                            };
                        }

                        return best;

                    },
                    null
                );


            if (
                nearest &&
                nearest.point
            ) {

                showTooltip(
                    event,
                    country,
                    nearest.point
                );
            }
        }
    );


    interaction.on(
        "mouseleave",
        hideTooltip
    );
}


function renderGlobalComparison() {

    const countries =
        comparisonCountries.length
            ? comparisonCountries
            : countryOrder;


    const scales =
        getScales();


    const width =
        container
            .node()
            .getBoundingClientRect()
            .width;


    const margin = {
        top: 70,
        right: 30,
        bottom: 72,
        left: 82
    };


    const chartWidth =
        width -
        margin.left -
        margin.right;


    const trackHeight = 220;
    const trackGap = 70;


    const totalHeight =
        margin.top +
        trackHeight +
        trackGap +
        trackHeight +
        margin.bottom;


    const svg =
        container
            .append("svg")
            .attr(
                "viewBox",
                `0 0 ${width} ${totalHeight}`
            )
            .attr(
                "width",
                "100%"
            );

        const currentDate =
            getCurrentDate();


        svg
            .append("text")
            .attr(
                "class",
                "global-date"
            )
            .attr(
                "x",
                width - 30
            )
            .attr(
                "y",
                27
            )
            .attr(
                "text-anchor",
                "end"
            )
            .text(
                currentDate
                    ? formatDate(
                        currentDate
                    )
                    : ""
            );


    const x =
        d3.scaleTime()
            .domain(
                scales.dateDomain
            )
            .range([
                0,
                chartWidth
            ]);


    const yAvg =
        d3.scaleLinear()
            .domain(
                scales.avgDomain
            )
            .range([
                trackHeight,
                0
            ]);


    const yRate =
        d3.scaleLinear()
            .domain(
                scales.rateDomain
            )
            .range([
                trackHeight,
                0
            ]);


    const upper =
        svg
            .append("g")
            .attr(
                "transform",
                `translate(
                    ${margin.left},
                    ${margin.top}
                )`
            );


    const lower =
        svg
            .append("g")
            .attr(
                "transform",
                `translate(
                    ${margin.left},
                    ${margin.top +
                    trackHeight +
                    trackGap}
                )`
            );


    drawAxes({
        upper,
        lower,
        x,
        yAvg,
        yRate,
        innerWidth: chartWidth,
        trackHeight
    });


    countries.forEach(country => {

        const countryData =
            data.filter(
                d =>
                    d.country === country
            );


        const visibleData =
            getAnimatedData(
                countryData
            );


        const avgLine =
            d3.line()
                .defined(
                    d =>
                        Number.isFinite(
                            d.avgDeaths
                        )
                )
                .x(
                    d => x(d.date)
                )
                .y(
                    d =>
                        yAvg(
                            d.avgDeaths
                        )
                );


        const rateLine =
            d3.line()
                .defined(
                    d =>
                        Number.isFinite(
                            d.rateChange
                        )
                )
                .x(
                    d => x(d.date)
                )
                .y(
                    d =>
                        yRate(
                            d.rateChange
                        )
                );


        upper
            .append("path")
            .datum(
                visibleData
            )
            .attr(
                "class",
                "global-line"
            )
            .attr(
                "d",
                avgLine
            )
            .attr(
                "stroke",
                countryColors[country]
            )
            .attr(
                "fill",
                "none"
            )
            .attr(
                "stroke-width",
                2
            );


        lower
            .append("path")
            .datum(
                visibleData
            )
            .attr(
                "class",
                "global-line"
            )
            .attr(
                "d",
                rateLine
            )
            .attr(
                "stroke",
                countryColors[country]
            )
            .attr(
                "fill",
                "none"
            )
            .attr(
                "stroke-width",
                2
            );
    });


    addGlobalLegend(
        svg,
        countries
    );


    addGlobalInteraction({
        svg,
        countries,
        x,
        yAvg,
        yRate,
        chartWidth,
        trackHeight,
        margin
    });
}


function addGlobalLegend(
    svg,
    countries
) {

    const legend =
        svg
            .append("g")
            .attr(
                "class",
                "global-legend"
            )
            .attr(
                "transform",
                "translate(82,24)"
            );


    countries.forEach(
        (country, index) => {

            const item =
                legend
                    .append("g")
                    .attr(
                        "transform",
                        `translate(
                            ${index * 125},
                            0
                        )`
                    );


            item
                .append("line")
                .attr(
                    "x1",
                    0
                )
                .attr(
                    "x2",
                    18
                )
                .attr(
                    "y1",
                    0
                )
                .attr(
                    "y2",
                    0
                )
                .attr(
                    "stroke",
                    countryColors[country]
                )
                .attr(
                    "stroke-width",
                    3
                );


            item
                .append("text")
                .attr(
                    "x",
                    24
                )
                .attr(
                    "y",
                    4
                )
                .text(country);
        }
    );
}

function addGlobalInteraction({
    svg,
    countries,
    x,
    yAvg,
    yRate,
    chartWidth,
    trackHeight,
    margin
}) {

    const upperCrosshair =
        svg
            .append("line")
            .attr("class", "global-crosshair")
            .attr("y1", margin.top)
            .attr("y2", margin.top + trackHeight)
            .style("display", "none");

    const lowerCrosshair =
        svg
            .append("line")
            .attr("class", "global-crosshair")
            .attr(
                "y1",
                margin.top +
                trackHeight +
                70
            )
            .attr(
                "y2",
                margin.top +
                trackHeight +
                70 +
                trackHeight
            )
            .style("display", "none");

    const upperPoints =
        svg
            .append("g")
            .attr(
                "class",
                "global-active-points"
            );

    const lowerPoints =
        svg
            .append("g")
            .attr(
                "class",
                "global-active-points"
            );

    const overlay =
        svg
            .append("rect")
            .attr(
                "class",
                "global-interaction"
            )
            .attr("x", margin.left)
            .attr("y", margin.top)
            .attr("width", chartWidth)
            .attr(
                "height",
                trackHeight * 2 + 70
            )
            .attr(
                "fill",
                "transparent"
            );

    overlay.on("mousemove", function(event) {

        const [svgX] = d3.pointer(
            event,
            svg.node()
        );

        const mouseX =
            svgX - margin.left;

        const clampedX =
            Math.max(
                0,
                Math.min(
                    chartWidth,
                    mouseX
                )
            );

        const hoveredDate =
            x.invert(clampedX);

        /*
         * Global Comparison uses the complete
         * shared date axis.
         */
        const activeDate =
            getNearestDateFromData(
                hoveredDate,
                availableDates.map(date => ({
                    date
                }))
            );

        if (!activeDate) {
            hideTooltip();
            return;
        }

        const selectedData =
            countries.map(country => {

                const point =
                    data.find(
                        d =>
                            d.country === country &&
                            +d.date === +activeDate
                    );

                return {
                    country,
                    point
                };
            });

        const validData =
            selectedData.filter(
                d => d.point
            );

        if (!validData.length) {
            return;
        }

        const xpos =
            x(activeDate);

        /*
         * Crosshairs use the EXACT same
         * x-position as the selected date.
         */
        upperCrosshair
            .attr(
                "x1",
                margin.left + xpos
            )
            .attr(
                "x2",
                margin.left + xpos
            )
            .style(
                "display",
                null
            );

        lowerCrosshair
            .attr(
                "x1",
                margin.left + xpos
            )
            .attr(
                "x2",
                margin.left + xpos
            )
            .style(
                "display",
                null
            );

        upperPoints
            .selectAll("*")
            .remove();

        lowerPoints
            .selectAll("*")
            .remove();

        selectedData.forEach(
            ({ country, point }) => {

                if (!point) {
                    return;
                }

                if (
                    Number.isFinite(
                        point.avgDeaths
                    )
                ) {

                    upperPoints
                        .append("circle")
                        .attr(
                            "cx",
                            margin.left + xpos
                        )
                        .attr(
                            "cy",
                            margin.top +
                            yAvg(
                                point.avgDeaths
                            )
                        )
                        .attr("r", 5)
                        .attr(
                            "fill",
                            countryColors[country]
                        )
                        .attr(
                            "stroke",
                            "#fffdf8"
                        )
                        .attr(
                            "stroke-width",
                            2
                        );
                }

                if (
                    Number.isFinite(
                        point.rateChange
                    )
                ) {

                    lowerPoints
                        .append("circle")
                        .attr(
                            "cx",
                            margin.left + xpos
                        )
                        .attr(
                            "cy",
                            margin.top +
                            trackHeight +
                            70 +
                            yRate(
                                point.rateChange
                            )
                        )
                        .attr("r", 5)
                        .attr(
                            "fill",
                            countryColors[country]
                        )
                        .attr(
                            "stroke",
                            "#fffdf8"
                        )
                        .attr(
                            "stroke-width",
                            2
                        );
                }
            }
        );

        showGlobalTooltip(
            event,
            activeDate,
            selectedData
        );
    });

    overlay.on(
        "mouseleave",
        () => {

            upperCrosshair
                .style(
                    "display",
                    "none"
                );

            lowerCrosshair
                .style(
                    "display",
                    "none"
                );

            upperPoints
                .selectAll("*")
                .remove();

            lowerPoints
                .selectAll("*")
                .remove();

            hideTooltip();
        }
    );
}

function showGlobalTooltip(
    event,
    date,
    selectedData
) {

    let tooltip =
        d3.select(
            "#chart-tooltip"
        );


    if (tooltip.empty()) {

        tooltip =
            d3.select("body")
                .append("div")
                .attr(
                    "id",
                    "chart-tooltip"
                )
                .attr(
                    "class",
                    "chart-tooltip"
                );
    }


    const rows =
        selectedData
            .filter(d => d.point)
            .map(
                ({ country, point }) => `
                    <div class="global-tooltip-country">
                        <span>
                            <i
                                style="
                                    background:
                                    ${countryColors[country]}
                                "
                            ></i>
                            ${country}
                        </span>
                    </div>

                    <div class="global-tooltip-values">
                        <span>
                            Avg.
                            ${formatValue(
                                point.avgDeaths
                            )}
                        </span>

                        <span>
                            Rate
                            ${formatRateValue(
                                point.rateChange
                            )}
                        </span>
                    </div>
                `
            )
            .join("");


    tooltip
        .html(`
            <div class="tooltip-date">
                ${formatDate(date)}
            </div>

            ${rows}
        `)
        .style(
            "display",
            "block"
        );


    const tooltipNode =
        tooltip.node();

    const tooltipWidth =
        tooltipNode.offsetWidth;

    const tooltipHeight =
        tooltipNode.offsetHeight;

    const gap = 12;


    let left =
        event.clientX + gap;

    let top =
        event.clientY - tooltipHeight / 2;


    if (
        left + tooltipWidth >
        window.innerWidth - 12
    ) {

        left =
            event.clientX -
            tooltipWidth -
            gap;
    }


    top =
        Math.max(
            12,
            Math.min(
                top,
                window.innerHeight -
                tooltipHeight -
                12
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
        );
}

function getAnimatedData(countryData) {

    // Default state: show the complete chart
    if (!animationPlaying && animationIndex === 0) {
        return countryData;
    }

    const currentDate = getCurrentDate();

    if (!currentDate) {
        return countryData;
    }

    return countryData.filter(
        d => d.date <= currentDate
    );
}

function startAnimation() {

    if (animationPlaying) {
        return;
    }


    if (
        !availableDates.length
    ) {
        return;
    }


    if (
        currentDateIndex >=
        availableDates.length - 1
    ) {

        currentDateIndex = 0;
        animationIndex = 0;
    }


    animationPlaying = true;

    playButton.text("Pause");


    animationTimer =
        d3.interval(
            () => {

                currentDateIndex += 1;

                animationIndex =
                    currentDateIndex;


                render();


                if (
                    currentDateIndex >=
                    availableDates.length - 1
                ) {

                    stopAnimation();
                }

            },
            100
        );
}


function stopAnimation() {

    animationPlaying = false;

    playButton.text("Play");


    if (animationTimer) {

        animationTimer.stop();

        animationTimer = null;
    }
}


function showTooltip(
    event,
    country,
    point
) {

    let tooltip =
        d3.select(
            "#chart-tooltip"
        );


    if (tooltip.empty()) {

        tooltip =
            d3.select("body")
                .append("div")
                .attr(
                    "id",
                    "chart-tooltip"
                )
                .attr(
                    "class",
                    "chart-tooltip"
                );
    }


    tooltip
        .html(`
            <div class="tooltip-country">
                ${country}
            </div>

            <div class="tooltip-date">
                ${formatDate(point.date)}
            </div>

            <div class="tooltip-row">
                <span>New deaths</span>
                <strong>
                    ${formatValue(point.newDeaths)}
                </strong>
            </div>

            <div class="tooltip-row">
                <span>Average deaths</span>
                <strong>
                    ${formatValue(point.avgDeaths)}
                </strong>
            </div>

            <div class="tooltip-row">
                <span>Rate of change</span>
                <strong>
                    ${formatRateValue(point.rateChange)}
                </strong>
            </div>
        `)
        .style(
            "display",
            "block"
        );


    const tooltipNode =
        tooltip.node();

    const tooltipWidth =
        tooltipNode.offsetWidth;

    const tooltipHeight =
        tooltipNode.offsetHeight;

    const gap = 12;

    let left =
        event.clientX + gap;

    let top =
        event.clientY - tooltipHeight / 2;


    if (
        left + tooltipWidth >
        window.innerWidth - 12
    ) {

        left =
            event.clientX -
            tooltipWidth -
            gap;
    }


    top =
        Math.max(
            12,
            Math.min(
                top,
                window.innerHeight -
                tooltipHeight -
                12
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
        );
}


function hideTooltip() {

    d3.select(
        "#chart-tooltip"
    )
    .style(
        "display",
        "none"
    );
}


function formatValue(value) {

    if (
        !Number.isFinite(value)
    ) {
        return "—";
    }

    return numberFormat(value);
}


function formatRateValue(value) {

    if (
        !Number.isFinite(value)
    ) {
        return "—";
    }

    return rateFormat(value);
}

function formatDateInput(date) {

    return d3.timeFormat(
        "%Y-%m-%d"
    )(date);
}


function parseDateInput(value) {

    if (!value) {
        return null;
    }


    const parts =
        value.split("-").map(Number);


    if (
        parts.length !== 3 ||
        parts.some(
            d => !Number.isFinite(d)
        )
    ) {
        return null;
    }


    return new Date(
        Date.UTC(
            parts[0],
            parts[1] - 1,
            parts[2]
        )
    );
}


function updateDateControl() {

    if (
        !availableDates.length
    ) {
        return;
    }


    dateSelect.property(
        "value",
        formatDateInput(
            availableDates[
                currentDateIndex
            ]
        )
    );
}


function getCurrentDate() {

    if (
        !availableDates.length
    ) {
        return null;
    }


    return availableDates[
        currentDateIndex
    ];
}