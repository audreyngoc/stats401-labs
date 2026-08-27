const chart = d3.select("#chart");

if (!chart.empty()) {

    const width = 800;
    const height = 450;

    const svg = chart
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    d3.csv("../data/students.csv", d => ({
        name: d.name,
        score: +d.score
    }))
    .then(data => {

        console.log("CSV data:", data);

        const barWidth = 70;
        const gap = 25;
        const bottomMargin = 100;

        svg.selectAll("rect")
            .data(data)
            .join("rect")
            .attr("x", (d, i) => i * (barWidth + gap) + 40)
            .attr("y", d => height - bottomMargin - d.score * 3)
            .attr("width", barWidth)
            .attr("height", d => d.score * 3)
            .attr("fill", "steelblue");

        svg.selectAll(".score-label")
            .data(data)
            .join("text")
            .attr("class", "score-label")
            .attr("x", (d, i) => i * (barWidth + gap) + 40 + barWidth / 2)
            .attr("y", d => height - bottomMargin - d.score * 3 - 10)
            .attr("text-anchor", "middle")
            .text(d => d.score);

        svg.selectAll(".name-label")
            .data(data)
            .join("text")
            .attr("class", "name-label")
            .attr("x", (d, i) => i * (barWidth + gap) + 40 + barWidth / 2)
            .attr("y", height - 50)
            .attr("text-anchor", "middle")
            .text(d => d.name);

    });
}