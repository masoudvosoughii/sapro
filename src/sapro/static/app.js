(function () {
  "use strict";

  const MIN_DIM = 1;
  const MAX_DIM = 20;
  const EPS = 1e-9;

  const EXAMPLES = {
    readme: {
      label: "Basic bounded maximization",
      optimization: "max",
      numVars: 2,
      numConstraints: 3,
      objective: [1, 2],
      constraints: [
        { coefficients: [1, 1], operator: "<=", rhs: 4 },
        { coefficients: [-2, 1], operator: "<=", rhs: 1 },
        { coefficients: [1, 0], operator: "<=", rhs: 3 },
      ],
    },
    minimization: {
      label: "Minimization",
      optimization: "min",
      numVars: 2,
      numConstraints: 1,
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: ">=", rhs: 4 }],
    },
    ge: {
      label: "Greater-than-or-equal constraint",
      optimization: "max",
      numVars: 1,
      numConstraints: 2,
      objective: [1],
      constraints: [
        { coefficients: [1], operator: ">=", rhs: 1 },
        { coefficients: [1], operator: "<=", rhs: 5 },
      ],
    },
    equality: {
      label: "Equality constraint",
      optimization: "max",
      numVars: 2,
      numConstraints: 1,
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: "==", rhs: 4 }],
    },
    mixed: {
      label: "Mixed operators",
      optimization: "max",
      numVars: 2,
      numConstraints: 3,
      objective: [1, 2],
      constraints: [
        { coefficients: [1, 0], operator: "<=", rhs: 4 },
        { coefficients: [0, 1], operator: ">=", rhs: 1 },
        { coefficients: [1, 1], operator: "==", rhs: 3 },
      ],
    },
    negative_rhs: {
      label: "Negative RHS",
      optimization: "max",
      numVars: 1,
      numConstraints: 2,
      objective: [1],
      constraints: [
        { coefficients: [1], operator: ">=", rhs: -5 },
        { coefficients: [1], operator: "<=", rhs: 3 },
      ],
    },
    infeasible: {
      label: "Infeasible problem",
      optimization: "max",
      numVars: 2,
      numConstraints: 3,
      objective: [1, 1],
      constraints: [
        { coefficients: [1, 0], operator: ">=", rhs: 5 },
        { coefficients: [0, 1], operator: ">=", rhs: 5 },
        { coefficients: [1, 1], operator: "<=", rhs: 1 },
      ],
    },
    unbounded: {
      label: "Unbounded problem",
      optimization: "max",
      numVars: 2,
      numConstraints: 2,
      objective: [1, 1],
      constraints: [
        { coefficients: [1, 0], operator: ">=", rhs: 1 },
        { coefficients: [0, 1], operator: ">=", rhs: 2 },
      ],
    },
    decimal: {
      label: "Decimal coefficients",
      optimization: "max",
      numVars: 2,
      numConstraints: 2,
      objective: [2.5, 1.5],
      constraints: [
        { coefficients: [1.5, 1], operator: "<=", rhs: 4 },
        { coefficients: [1, 0], operator: "<=", rhs: 2 },
      ],
    },
  };

  const CONSTRAINT_COLORS = ["#245bdb", "#1f7a4d", "#b45309", "#7c3aed", "#be123c"];

  let lastSolvePayload = null;

  const els = {
    numVars: document.getElementById("num-vars"),
    numConstraints: document.getElementById("num-constraints"),
    objectiveGrid: document.getElementById("objective-grid"),
    constraintGrid: document.getElementById("constraint-grid"),
    problemPreview: document.getElementById("problem-preview"),
    statusBox: document.getElementById("status-box"),
    resultSummary: document.getElementById("result-summary"),
    feasibleViz: document.getElementById("feasible-region-viz"),
    feasibleNote: document.getElementById("feasible-region-note"),
    stepsContainer: document.getElementById("steps-container"),
    exampleSelect: document.getElementById("example-select"),
    solveBtn: document.getElementById("solve-btn"),
    newProblemBtn: document.getElementById("new-problem-btn"),
    loadExampleBtn: document.getElementById("load-example-btn"),
  };

  function clampDimension(value) {
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed)) {
      return MIN_DIM;
    }
    return Math.min(MAX_DIM, Math.max(MIN_DIM, parsed));
  }

  function getOptimization() {
    const selected = document.querySelector('input[name="optimization"]:checked');
    return selected ? selected.value : "max";
  }

  function setOptimization(value) {
    const input = document.querySelector(`input[name="optimization"][value="${value}"]`);
    if (input) {
      input.checked = true;
    }
  }

  function makeNumberInput(value) {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.value = value;
    input.addEventListener("input", updateProblemPreview);
    return input;
  }

  function renderObjectiveGrid(numVars, values) {
    els.objectiveGrid.innerHTML = "";
    const table = document.createElement("table");
    table.className = "coeff-grid";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.appendChild(document.createElement("th"));
    for (let j = 0; j < numVars; j += 1) {
      const th = document.createElement("th");
      th.textContent = `x${j + 1}`;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const row = document.createElement("tr");
    const label = document.createElement("td");
    label.className = "row-label";
    label.textContent = "Objective";
    row.appendChild(label);
    for (let j = 0; j < numVars; j += 1) {
      const cell = document.createElement("td");
      cell.appendChild(makeNumberInput(values ? values[j] : 0));
      cell.querySelector("input").dataset.objectiveIndex = String(j);
      row.appendChild(cell);
    }
    tbody.appendChild(row);
    table.appendChild(tbody);
    els.objectiveGrid.appendChild(table);
  }

  function renderConstraintGrid(numVars, numConstraints, rows) {
    els.constraintGrid.innerHTML = "";
    const table = document.createElement("table");
    table.className = "coeff-grid";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.appendChild(document.createElement("th"));
    for (let j = 0; j < numVars; j += 1) {
      const th = document.createElement("th");
      th.textContent = `x${j + 1}`;
      headRow.appendChild(th);
    }
    ["Operator", "RHS"].forEach((headerLabel) => {
      const th = document.createElement("th");
      th.textContent = headerLabel;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let i = 0; i < numConstraints; i += 1) {
      const rowData = rows ? rows[i] : null;
      const tr = document.createElement("tr");
      const label = document.createElement("td");
      label.className = "row-label";
      label.textContent = `C${i + 1}`;
      tr.appendChild(label);

      for (let j = 0; j < numVars; j += 1) {
        const cell = document.createElement("td");
        const coef = rowData ? rowData.coefficients[j] : 0;
        cell.appendChild(makeNumberInput(coef));
        cell.querySelector("input").dataset.constraintIndex = String(i);
        cell.querySelector("input").dataset.varIndex = String(j);
        tr.appendChild(cell);
      }

      const opCell = document.createElement("td");
      const opSelect = document.createElement("select");
      ["<=", ">=", "=="].forEach((op) => {
        const option = document.createElement("option");
        option.value = op;
        option.textContent = op;
        opSelect.appendChild(option);
      });
      opSelect.value = rowData ? rowData.operator : "<=";
      opSelect.dataset.constraintIndex = String(i);
      opSelect.dataset.role = "operator";
      opSelect.addEventListener("change", updateProblemPreview);
      opCell.appendChild(opSelect);
      tr.appendChild(opCell);

      const rhsCell = document.createElement("td");
      const rhsValue = rowData ? rowData.rhs : 0;
      rhsCell.appendChild(makeNumberInput(rhsValue));
      rhsCell.querySelector("input").dataset.constraintIndex = String(i);
      rhsCell.querySelector("input").dataset.role = "rhs";
      tr.appendChild(rhsCell);

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    els.constraintGrid.appendChild(table);
  }

  function rebuildGrids() {
    const numVars = clampDimension(els.numVars.value);
    const numConstraints = clampDimension(els.numConstraints.value);
    els.numVars.value = String(numVars);
    els.numConstraints.value = String(numConstraints);
    renderObjectiveGrid(numVars);
    renderConstraintGrid(numVars, numConstraints);
    updateProblemPreview();
  }

  function collectPayload() {
    const numVars = clampDimension(els.numVars.value);
    const numConstraints = clampDimension(els.numConstraints.value);
    const objective = [];
    for (let j = 0; j < numVars; j += 1) {
      const input = els.objectiveGrid.querySelector(`input[data-objective-index="${j}"]`);
      objective.push(Number.parseFloat(input.value));
    }

    const constraints = [];
    for (let i = 0; i < numConstraints; i += 1) {
      const coefficients = [];
      for (let j = 0; j < numVars; j += 1) {
        const input = els.constraintGrid.querySelector(
          `input[data-constraint-index="${i}"][data-var-index="${j}"]`
        );
        coefficients.push(Number.parseFloat(input.value));
      }
      const operator = els.constraintGrid.querySelector(
        `select[data-constraint-index="${i}"][data-role="operator"]`
      ).value;
      const rhsInput = els.constraintGrid.querySelector(
        `input[data-constraint-index="${i}"][data-role="rhs"]`
      );
      constraints.push({
        coefficients,
        operator,
        rhs: Number.parseFloat(rhsInput.value),
      });
    }

    return {
      optimization: getOptimization(),
      objective,
      constraints,
    };
  }

  function formatNumber(value) {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return Number(value).toFixed(6).replace(/\.?0+$/, "");
  }

  function formatTerm(coef, varName, isFirst) {
    if (Math.abs(coef) < EPS) {
      return "";
    }
    const absCoef = Math.abs(coef);
    let coefPart = "";
    if (absCoef !== 1) {
      coefPart = formatNumber(absCoef);
    }
    const term = `${coefPart}${varName}`;
    if (isFirst) {
      return coef < 0 ? `-${term}` : term;
    }
    return coef < 0 ? ` - ${term}` : ` + ${term}`;
  }

  function formatObjectiveExpression(objective) {
    let expr = "";
    let first = true;
    objective.forEach((coef, index) => {
      const part = formatTerm(coef, `x${index + 1}`, first);
      if (part) {
        expr += part;
        first = false;
      }
    });
    return expr || "0";
  }

  function formatConstraintLine(row) {
    const lhs = formatObjectiveExpression(row.coefficients);
    const op = row.operator === "==" ? "=" : row.operator;
    return `${lhs} ${op} ${formatNumber(row.rhs)}`;
  }

  function buildProblemPreviewText(payload) {
    const dir = payload.optimization === "max" ? "Max" : "Min";
    const lines = [`${dir} Z = ${formatObjectiveExpression(payload.objective)}`, "", "Subject to:"];
    payload.constraints.forEach((row) => {
      lines.push(formatConstraintLine(row));
    });
    const varNames = payload.objective.map((_, index) => `x${index + 1}`).join(", ");
    lines.push("", `${varNames} >= 0`);
    return lines.join("\n");
  }

  function updateProblemPreview() {
    els.problemPreview.textContent = buildProblemPreviewText(collectPayload());
  }

  function buildMethodLine(phaseCounts) {
    if (!phaseCounts || phaseCounts.phase_one === 0) {
      return "Method: Simplex";
    }
    return `Method: Two-Phase Simplex · Phase I: ${phaseCounts.phase_one} · Phase II: ${phaseCounts.phase_two}`;
  }

  function formatStepHeading(step) {
    if (step.enter && step.leave) {
      return `Step ${step.index}: ${step.enter} enters, ${step.leave} leaves`;
    }
    if (step.enter) {
      return `Step ${step.index}: ${step.enter} enters`;
    }
    if (step.leave) {
      return `Step ${step.index}: ${step.leave} leaves`;
    }
    return `Step ${step.index}`;
  }

  function loadExample(key) {
    const example = EXAMPLES[key];
    if (!example) {
      return;
    }
    setOptimization(example.optimization);
    els.numVars.value = String(example.numVars);
    els.numConstraints.value = String(example.numConstraints);
    renderObjectiveGrid(example.numVars, example.objective);
    renderConstraintGrid(example.numVars, example.numConstraints, example.constraints);
    updateProblemPreview();
  }

  function resetNewProblem() {
    setOptimization("max");
    els.numVars.value = "2";
    els.numConstraints.value = "2";
    renderObjectiveGrid(2, [0, 0]);
    renderConstraintGrid(2, 2, [
      { coefficients: [0, 0], operator: "<=", rhs: 0 },
      { coefficients: [0, 0], operator: "<=", rhs: 0 },
    ]);
    lastSolvePayload = null;
    clearResults("Form reset.");
    updateProblemPreview();
  }

  function clearResults(message) {
    els.statusBox.textContent = message || "";
    els.statusBox.className = "";
    els.resultSummary.innerHTML = '<p class="empty-state">No results yet.</p>';
    els.stepsContainer.innerHTML = "";
    renderFeasibleRegion(null, collectPayload());
  }

  function renderTableau(tableau) {
    if (!tableau || !tableau.length) {
      return '<p class="empty-state">No tableau data.</p>';
    }
    const headers = tableau[0];
    const bodyRows = tableau.slice(1, -1);
    const footer = tableau[tableau.length - 1];
    let html = '<table class="tableau"><thead><tr>';
    headers.forEach((header) => {
      html += `<th>${header}</th>`;
    });
    html += "</tr></thead><tbody>";
    bodyRows.forEach((row) => {
      html += "<tr>";
      row.forEach((cell) => {
        html += `<td>${cell}</td>`;
      });
      html += "</tr>";
    });
    html += "<tr>";
    footer.forEach((cell) => {
      html += `<td>${cell}</td>`;
    });
    html += "</tr></tbody></table>";
    return html;
  }

  function renderSteps(steps) {
    els.stepsContainer.innerHTML = "";
    if (!steps || !steps.length) {
      return;
    }
    steps.forEach((step) => {
      const details = document.createElement("details");
      details.className = "step-panel";
      const summary = document.createElement("summary");
      summary.textContent = formatStepHeading(step);
      details.appendChild(summary);
      const body = document.createElement("div");
      body.className = "step-body math-ltr";
      body.innerHTML = renderTableau(step.tableau);
      details.appendChild(body);
      details.addEventListener("toggle", () => {
        summary.setAttribute("aria-expanded", details.open ? "true" : "false");
      });
      summary.setAttribute("aria-expanded", "false");
      els.stepsContainer.appendChild(details);
    });
  }

  function renderResult(data, payload) {
    lastSolvePayload = payload || collectPayload();

    if (!data.ok) {
      els.statusBox.textContent = data.message || "Request failed.";
      els.statusBox.className = "error";
      els.resultSummary.innerHTML = `
        <p><strong>Status:</strong> ${data.status || "error"}</p>
        <p>${data.message || "Unknown error."}</p>
      `;
      els.stepsContainer.innerHTML = "";
      renderFeasibleRegion(data, lastSolvePayload);
      return;
    }

    els.statusBox.textContent = data.status_label || "Optimal solution found.";
    els.statusBox.className = "ok";

    const vars = Object.entries(data.variable_values || {})
      .map(([name, value]) => `${name} = ${formatNumber(value)}`)
      .join(", ");

    const phaseCounts = data.phase_counts || {
      phase_one: 0,
      phase_two: data.step_count || 0,
      total: data.step_count || 0,
    };
    const totalIterations = phaseCounts.total ?? data.step_count ?? 0;

    els.resultSummary.innerHTML = `
      <p><strong>Status:</strong> ${data.status_label || "Optimal solution found."}</p>
      <p><strong>Objective (Z):</strong> ${formatNumber(data.objective_value)}</p>
      <p><strong>Decision variables:</strong> ${vars || "None"}</p>
      <p><strong>Iterations:</strong> ${totalIterations}</p>
      <p class="method-line">${buildMethodLine(phaseCounts)}</p>
    `;

    renderSteps(data.steps || []);
    renderFeasibleRegion(data, lastSolvePayload);
  }

  // -------------------------------------------------------------------------
  // Feasible-region geometry (plotting only; never solves the LP)
  // -------------------------------------------------------------------------

  function nearlyZero(value) {
    return Math.abs(value) < EPS;
  }

  function evalConstraint(a, b, x, y) {
    return a * x + b * y;
  }

  function insideHalfPlane(a, b, rhs, op, x, y) {
    const value = evalConstraint(a, b, x, y);
    if (op === "<=") {
      return value <= rhs + EPS;
    }
    if (op === ">=") {
      return value >= rhs - EPS;
    }
    return Math.abs(value - rhs) <= EPS;
  }

  function intersectSegmentWithLine(p1, p2, a, b, rhs) {
    const f1 = evalConstraint(a, b, p1.x, p1.y) - rhs;
    const f2 = evalConstraint(a, b, p2.x, p2.y) - rhs;
    if (Math.abs(f2 - f1) < EPS) {
      return null;
    }
    const t = f1 / (f1 - f2);
    return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
  }

  function clipPolygon(polygon, a, b, rhs, op) {
    if (!polygon.length) {
      return [];
    }
    const output = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const current = polygon[i];
      const previous = polygon[(i + polygon.length - 1) % polygon.length];
      const currInside = insideHalfPlane(a, b, rhs, op, current.x, current.y);
      const prevInside = insideHalfPlane(a, b, rhs, op, previous.x, previous.y);
      if (currInside) {
        if (!prevInside) {
          const hit = intersectSegmentWithLine(previous, current, a, b, rhs);
          if (hit) {
            output.push(hit);
          }
        }
        output.push(current);
      } else if (prevInside) {
        const hit = intersectSegmentWithLine(previous, current, a, b, rhs);
        if (hit) {
          output.push(hit);
        }
      }
    }
    return output;
  }

  function computeViewport(payload, optimalPoint) {
    let maxX = 1;
    let maxY = 1;
    payload.constraints.forEach((row) => {
      const [a, b] = row.coefficients;
      if (!nearlyZero(a)) {
        maxX = Math.max(maxX, row.rhs / a);
      }
      if (!nearlyZero(b)) {
        maxY = Math.max(maxY, row.rhs / b);
      }
    });
    if (optimalPoint) {
      maxX = Math.max(maxX, optimalPoint.x * 1.2);
      maxY = Math.max(maxY, optimalPoint.y * 1.2);
    }
    maxX = Math.max(4, maxX * 1.2);
    maxY = Math.max(4, maxY * 1.2);
    return { minX: 0, minY: 0, maxX, maxY };
  }

  function buildFeasiblePolygon(payload, viewport) {
    let polygon = [
      { x: viewport.minX, y: viewport.minY },
      { x: viewport.maxX, y: viewport.minY },
      { x: viewport.maxX, y: viewport.maxY },
      { x: viewport.minX, y: viewport.maxY },
    ];
    polygon = clipPolygon(polygon, 1, 0, 0, ">=");
    polygon = clipPolygon(polygon, 0, 1, 0, ">=");
    payload.constraints.forEach((row) => {
      if (row.operator === "==") {
        return;
      }
      const [a, b] = row.coefficients;
      polygon = clipPolygon(polygon, a, b, row.rhs, row.operator);
    });
    return polygon;
  }

  function lineSegmentInViewport(a, b, rhs, viewport) {
    const points = [];
    const { minX, maxX, minY, maxY } = viewport;
    if (!nearlyZero(b)) {
      points.push({ x: minX, y: (rhs - a * minX) / b });
      points.push({ x: maxX, y: (rhs - a * maxX) / b });
    }
    if (!nearlyZero(a)) {
      points.push({ x: (rhs - b * minY) / a, y: minY });
      points.push({ x: (rhs - b * maxY) / a, y: maxY });
    }
    const clipped = points.filter(
      (p) => p.x >= minX - EPS && p.x <= maxX + EPS && p.y >= minY - EPS && p.y <= maxY + EPS
    );
    if (clipped.length < 2) {
      return null;
    }
    return [clipped[0], clipped[clipped.length - 1]];
  }

  function polygonArea(polygon) {
    if (polygon.length < 3) {
      return 0;
    }
    let area = 0;
    for (let i = 0; i < polygon.length; i += 1) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];
      area += p1.x * p2.y - p2.x * p1.y;
    }
    return Math.abs(area) / 2;
  }

  function renderFeasibleRegion(result, payload) {
    els.feasibleNote.hidden = true;
    els.feasibleNote.textContent = "";
    els.feasibleViz.setAttribute("aria-label", "Feasible region chart for two decision variables");

    if (payload.objective.length !== 2) {
      els.feasibleViz.innerHTML =
        '<p class="viz-message">Two-dimensional visualization is available only for problems with exactly two decision variables.</p>';
      return;
    }

    const optimalPoint =
      result && result.ok && result.variable_values
        ? {
            x: Number(result.variable_values.x1),
            y: Number(result.variable_values.x2),
          }
        : null;

    const viewport = computeViewport(payload, optimalPoint);
    const width = 420;
    const height = 320;
    const pad = 36;

    function toSvgX(x) {
      return pad + ((x - viewport.minX) / (viewport.maxX - viewport.minX)) * (width - 2 * pad);
    }
    function toSvgY(y) {
      return height - pad - ((y - viewport.minY) / (viewport.maxY - viewport.minY)) * (height - 2 * pad);
    }

    let note = "";
    if (result && !result.ok && result.status === "infeasible") {
      note = "No feasible region exists.";
    } else if (result && !result.ok && result.status === "unbounded") {
      note = "The feasible region continues beyond the displayed chart.";
    }

    const hasEquality = payload.constraints.some((row) => row.operator === "==");
    const polygon = buildFeasiblePolygon(payload, viewport);
    const area = polygonArea(polygon);
    const showFill = area > EPS && !(result && !result.ok && result.status === "infeasible");

    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Feasible region chart for two decision variables" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="#fafbfd"/>`;

    svg += `<line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#64748b" stroke-width="1"/>`;
    svg += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#64748b" stroke-width="1"/>`;
    svg += `<text x="${width - pad}" y="${height - pad + 20}" text-anchor="end" font-size="12">x1</text>`;
    svg += `<text x="${pad - 8}" y="${pad}" text-anchor="end" font-size="12">x2</text>`;

    if (showFill) {
      const points = polygon.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(" ");
      svg += `<polygon points="${points}" fill="rgba(36, 91, 219, 0.18)" stroke="#245bdb" stroke-width="1.5"/>`;
    }

    payload.constraints.forEach((row, index) => {
      const [a, b] = row.coefficients;
      const color = CONSTRAINT_COLORS[index % CONSTRAINT_COLORS.length];
      const segment = lineSegmentInViewport(a, b, row.rhs, viewport);
      if (!segment) {
        return;
      }
      const dash = row.operator === "==" ? "" : ' stroke-dasharray="6 4"';
      svg += `<line x1="${toSvgX(segment[0].x)}" y1="${toSvgY(segment[0].y)}" x2="${toSvgX(segment[1].x)}" y2="${toSvgY(segment[1].y)}" stroke="${color}" stroke-width="2"${dash}/>`;
      const labelX = toSvgX(segment[1].x);
      const labelY = toSvgY(segment[1].y) - 6;
      svg += `<text x="${labelX}" y="${labelY}" font-size="11" fill="${color}">C${index + 1}</text>`;
    });

    if (optimalPoint && Number.isFinite(optimalPoint.x) && Number.isFinite(optimalPoint.y)) {
      svg += `<circle cx="${toSvgX(optimalPoint.x)}" cy="${toSvgY(optimalPoint.y)}" r="5" fill="#1f7a4d" stroke="#fff" stroke-width="1.5"/>`;
      svg += `<text x="${toSvgX(optimalPoint.x) + 8}" y="${toSvgY(optimalPoint.y) - 8}" font-size="11" fill="#1f7a4d">Optimal point (${formatNumber(optimalPoint.x)}, ${formatNumber(optimalPoint.y)})</text>`;
    }

    svg += '<text x="' + pad + '" y="18" font-size="11" fill="#475569">Constraints</text>';
    svg += "</svg>";

    els.feasibleViz.innerHTML = svg;

    if (note) {
      els.feasibleNote.hidden = false;
      els.feasibleNote.textContent = note;
    } else if (hasEquality && area <= EPS) {
      els.feasibleNote.hidden = false;
      els.feasibleNote.textContent =
        "Equality constraints are shown as lines; lower-dimensional feasible sets may not be shaded.";
    } else if (result && !result.ok && result.status === "unbounded") {
      els.feasibleNote.hidden = false;
      els.feasibleNote.textContent = "The feasible region continues beyond the displayed chart.";
    }
  }

  async function solve() {
    clearResults("Solving...");
    const payload = collectPayload();
    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      renderResult(data, payload);
    } catch (error) {
      els.statusBox.textContent = "Could not reach the local solver.";
      els.statusBox.className = "error";
      els.resultSummary.innerHTML = `<p>${error.message}</p>`;
      renderFeasibleRegion(null, payload);
    }
  }

  function populateExampleSelect() {
    els.exampleSelect.innerHTML = "";
    Object.entries(EXAMPLES).forEach(([key, example]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = example.label;
      els.exampleSelect.appendChild(option);
    });
  }

  els.numVars.addEventListener("change", rebuildGrids);
  els.numConstraints.addEventListener("change", rebuildGrids);
  els.solveBtn.addEventListener("click", solve);
  els.newProblemBtn.addEventListener("click", resetNewProblem);
  els.loadExampleBtn.addEventListener("click", () => {
    loadExample(els.exampleSelect.value);
  });
  document.querySelectorAll('input[name="optimization"]').forEach((input) => {
    input.addEventListener("change", updateProblemPreview);
  });

  populateExampleSelect();
  loadExample("readme");

  window.__saproUi = {
    buildProblemPreviewText,
    formatObjectiveExpression,
    formatTerm,
    buildMethodLine,
    formatStepHeading,
    buildFeasiblePolygon,
    polygonArea,
    computeViewport,
    EXAMPLES,
    collectPayload,
    resetNewProblem,
    renderFeasibleRegion,
  };
})();
