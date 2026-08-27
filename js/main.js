const labNav = document.querySelector("#lab-nav");

if (labNav) {

    const isHomePage =
        window.location.pathname.endsWith("/stats401-labs/") ||
        window.location.pathname.endsWith("/stats401-labs/index.html");

    const prefix = isHomePage ? "" : "..";

    const labs = [
        { name: "Home", url: `${prefix}/index.html` },
        { name: "Lab 1", url: `${prefix}/lab1/index.html` },
        { name: "Lab 2", url: `${prefix}/lab2/index.html` },
        { name: "Lab 3", url: `${prefix}/lab3/index.html` },
        { name: "Lab 4", url: `${prefix}/lab4/index.html` },
        { name: "Lab 5", url: `${prefix}/lab5/index.html` },
        { name: "Lab 6", url: `${prefix}/lab6/index.html` },
        { name: "Lab 7", url: `${prefix}/lab7/index.html` },
        { name: "Lab 8", url: `${prefix}/lab8/index.html` },
        { name: "Lab 9", url: `${prefix}/lab9/index.html` },
        { name: "Lab 10", url: `${prefix}/lab10/index.html` }
    ];

    labs.forEach(lab => {

        const link = document.createElement("a");

        link.href = lab.url;
        link.textContent = lab.name;

        labNav.appendChild(link);

    });
}