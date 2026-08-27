const practiceWidth = 800;
const practiceHeight = 500;

const practiceMargin = {
    top: 40,
    right: 170,
    bottom: 70,
    left: 70
};

const practiceTooltip = d3.select("#tooltip");


// Load and parse practice data
d3.csv(
    "../data/students_multivariate.csv",
    d => ({
        name: d.name,
        study_hours: +d.study_hours,
        score: +d.score,
        major: d.major,
        year: d.year
    })
)
.then(data => {

    const svg = d3.select("#practice-chart")
        .append("svg")
        .attr(
            "viewBox",
            `0 0 ${practiceWidth} ${practiceHeight}`
        )
        .attr(
            "preserveAspectRatio",
            "xMidYMid meet"
        );


    // Define scales

    const xScale = d3.scaleLinear()
        .domain(
            d3.extent(
                data,
                d => d.study_hours
            )
        )
        .nice()
        .range([
            practiceMargin.left,
            practiceWidth - practiceMargin.right
        ]);


    const yScale = d3.scaleLinear()
        .domain(
            d3.extent(
                data,
                d => d.score
            )
        )
        .nice()
        .range([
            practiceHeight - practiceMargin.bottom,
            practiceMargin.top
        ]);


    const majors = Array.from(
        new Set(
            data.map(d => d.major)
        )
    );


    const colorScale = d3.scaleOrdinal()
        .domain(majors)
        .range(d3.schemeTableau10);


    const sizeScale = d3.scaleOrdinal()
        .domain([
            "Freshman",
            "Sophomore",
            "Junior",
            "Senior"
        ])
        .range([
            5,
            7,
            9,
            11
        ]);


    // Add axes

    svg.append("g")
        .attr(
            "transform",
            `translate(
                0,
                ${practiceHeight - practiceMargin.bottom}
            )`
        )
        .call(
            d3.axisBottom(xScale)
        );


    svg.append("g")
        .attr(
            "transform",
            `translate(
                ${practiceMargin.left},
                0
            )`
        )
        .call(
            d3.axisLeft(yScale)
        );


    // Add data points

    svg.selectAll(".student-point")
        .data(data)
        .join("circle")
        .attr(
            "class",
            "student-point"
        )
        .attr(
            "cx",
            d => xScale(d.study_hours)
        )
        .attr(
            "cy",
            d => yScale(d.score)
        )
        .attr(
            "r",
            d => sizeScale(d.year)
        )
        .attr(
            "fill",
            d => colorScale(d.major)
        )
        .attr(
            "opacity",
            0.8
        )


        // Interactive tooltip

        .on(
            "mouseover",
            function(event, d) {

                practiceTooltip
                    .style(
                        "opacity",
                        1
                    )
                    .html(`
                        <strong>${d.name}</strong><br>
                        Study Hours: ${d.study_hours}<br>
                        Score: ${d.score}<br>
                        Major: ${d.major}<br>
                        Year: ${d.year}
                    `);
            }
        )


        .on(
            "mousemove",
            function(event) {

                practiceTooltip
                    .style(
                        "left",
                        `${event.pageX + 10}px`
                    )
                    .style(
                        "top",
                        `${event.pageY + 10}px`
                    );
            }
        )


        .on(
            "mouseout",
            function() {

                practiceTooltip
                    .style(
                        "opacity",
                        0
                    );
            }
        );

});