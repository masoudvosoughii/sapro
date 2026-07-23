(function () {
  "use strict";

  const MIN_DIM = 1;
  const MAX_DIM = 20;
  const EPS = 1e-9;

  const I18N = {
    en: {
      pageTitle: "Simplex Method Solver",
      pageSubtitle: "Advanced Optimization Course Project",
      identityHtml:
        "Developed by Masoud Vosoughi<br>" +
        "Instructor: Mohsen Rostami Mal Khalife<br>" +
        "Islamic Azad University, Science and Research Branch<br>" +
        "Faculty of Converging Sciences and Technologies",
      footer: "Simplex Method Solver — Advanced Optimization Course Project",
      problemInput: "Problem Input",
      results: "Results",
      optimization: "Optimization:",
      maximize: "Maximize",
      minimize: "Minimize",
      decisionVariables: "Decision variables",
      constraints: "Constraints",
      objective: "Objective",
      operator: "Operator",
      rhs: "RHS",
      solve: "Solve",
      newProblem: "New Problem",
      loadExample: "Load example",
      loadExampleBtn: "Load Example",
      problemPreview: "Problem Preview",
      expandAll: "Expand All",
      collapseAll: "Collapse All",
      noResults: "No results yet.",
      status: "Status",
      objectiveValue: "Objective (Z)",
      decisionVariablesResult: "Decision variables",
      phaseOneIterations: "Phase I iterations",
      phaseTwoIterations: "Phase II iterations",
      totalIterations: "Total iterations",
      feasibleRegion: "Feasible Region",
      vizUnavailable:
        "Two-dimensional visualization is available only for problems with exactly two decision variables.",
      noFeasibleRegion: "No feasible region exists.",
      unboundedNotice: "The feasible region continues beyond the displayed chart.",
      equalityNote:
        "Equality constraints are shown as lines; lower-dimensional feasible sets may not be shaded.",
      solving: "Solving...",
      formReset: "Form reset.",
      networkError: "Could not reach the local solver.",
      subjectTo: "Subject to:",
      constraintsLabel: "Subject to:",
      nonNegativity: "non-negativity",
      maxVerb: "Max",
      minVerb: "Min",
      phaseOne: "Phase I",
      phaseTwo: "Phase II",
      stepEnterLeave: "Step {index} ({phase}, #{phaseIter}): {enter} enters, {leave} leaves",
      optimal: "Optimal solution found.",
      infeasible: "The problem has no feasible solution.",
      unbounded: "The problem is unbounded.",
      cycle: "The simplex algorithm encountered a cycling basis.",
      numericalFailure: "The solver encountered a numerical failure.",
      iterationLimit: "Iteration limit reached.",
      internalError: "An unexpected internal error occurred while solving the problem.",
      invalidInput: "Invalid input.",
      requestFailed: "Request failed.",
      unknownError: "Unknown error.",
      exampleReadme: "Basic bounded maximization",
      exampleMinimization: "Minimization",
      exampleGe: "Greater-than-or-equal constraint",
      exampleEquality: "Equality constraint",
      exampleMixed: "Mixed operators",
      exampleNegativeRhs: "Negative RHS",
      exampleInfeasible: "Infeasible problem",
      exampleUnbounded: "Unbounded problem",
      exampleDecimal: "Decimal coefficients",
      optimalPoint: "Optimal point",
      legendConstraints: "Constraints",
      chartAriaLabel: "Feasible region chart for two decision variables",
    },
    fa: {
      pageTitle: "حل‌گر روش سیمپلکس",
      pageSubtitle: "پروژه درس بهینه‌سازی پیشرفته",
      identityHtml:
        "توسعه‌دهنده: Masoud Vosoughi<br>" +
        "استاد: Mohsen Rostami Mal Khalife<br>" +
        "دانشگاه آزاد اسلامی، واحد علوم و تحقیقات<br>" +
        "دانشکده علوم و فناوری‌های همگرا",
      footer: "حل‌گر روش سیمپلکس — پروژه درس بهینه‌سازی پیشرفته",
      problemInput: "ورود مسئله",
      results: "نتایج",
      optimization: "بهینه‌سازی:",
      maximize: "بیشینه‌سازی",
      minimize: "کمینه‌سازی",
      decisionVariables: "متغیرهای تصمیم",
      constraints: "محدودیت‌ها",
      objective: "تابع هدف",
      operator: "عملگر",
      rhs: "مقدار ثابت",
      solve: "حل",
      newProblem: "مسئله جدید",
      loadExample: "بارگذاری مثال",
      loadExampleBtn: "بارگذاری مثال",
      problemPreview: "پیش‌نمایش مسئله",
      expandAll: "باز کردن همه مراحل",
      collapseAll: "بستن همه مراحل",
      noResults: "هنوز نتیجه‌ای وجود ندارد.",
      status: "وضعیت",
      objectiveValue: "مقدار تابع هدف (Z)",
      decisionVariablesResult: "متغیرهای تصمیم",
      phaseOneIterations: "تعداد تکرارهای فاز اول",
      phaseTwoIterations: "تعداد تکرارهای فاز دوم",
      totalIterations: "مجموع تکرارها",
      feasibleRegion: "ناحیه شدنی",
      vizUnavailable:
        "بصری‌سازی دوبعدی فقط برای مسائل دارای دقیقاً دو متغیر تصمیم در دسترس است.",
      noFeasibleRegion: "ناحیه شدنی وجود ندارد.",
      unboundedNotice: "ناحیه شدنی فراتر از محدوده نمایش‌داده‌شده ادامه دارد.",
      equalityNote:
        "محدودیت‌های برابری به‌صورت خط نمایش داده می‌شوند؛ مجموعه‌های شدنی با بعد پایین‌تر ممکن است سایه‌زده نشوند.",
      solving: "در حال حل...",
      formReset: "فرم بازنشانی شد.",
      networkError: "ارتباط با حل‌گر محلی برقرار نشد.",
      subjectTo: "با محدودیت‌های:",
      constraintsLabel: "با محدودیت‌های:",
      nonNegativity: "نامنفی بودن",
      maxVerb: "بیشینه‌سازی",
      minVerb: "کمینه‌سازی",
      phaseOne: "فاز اول",
      phaseTwo: "فاز دوم",
      stepEnterLeave: "مرحله {index} ({phase}، #{phaseIter}): {enter} وارد، {leave} خارج",
      optimal: "جواب بهینه یافت شد.",
      infeasible: "مسئله جواب شدنی ندارد.",
      unbounded: "مسئله نامحدود است.",
      cycle: "الگوریتم سیمپلکس با چرخه در پایه مواجه شد.",
      numericalFailure: "حل‌گر با خطای عددی مواجه شد.",
      iterationLimit: "حد تکرار رسیده است.",
      internalError: "خطای داخلی غیرمنتظره هنگام حل مسئله رخ داد.",
      invalidInput: "ورودی نامعتبر.",
      requestFailed: "درخواست ناموفق بود.",
      unknownError: "خطای ناشناخته.",
      exampleReadme: "بیشینه‌سازی کران‌دار پایه",
      exampleMinimization: "کمینه‌سازی",
      exampleGe: "محدودیت بزرگ‌تر یا مساوی",
      exampleEquality: "محدودیت برابری",
      exampleMixed: "عملگرهای مختلط",
      exampleNegativeRhs: "مقدار ثابت منفی",
      exampleInfeasible: "مسئله ناممکن",
      exampleUnbounded: "مسئله نامحدود",
      exampleDecimal: "ضرایب اعشاری",
      optimalPoint: "نقطه بهینه",
      legendConstraints: "محدودیت‌ها",
      chartAriaLabel: "نمودار ناحیه شدنی برای دو متغیر تصمیم",
    },
  };

  const ERROR_STATUS_KEYS = {
    optimal: "optimal",
    infeasible: "infeasible",
    unbounded: "unbounded",
    cycle: "cycle",
    numerical_failure: "numericalFailure",
    iteration_limit: "iterationLimit",
    internal_error: "internalError",
    invalid_input: "invalidInput",
  };

  const EXAMPLES = {
    readme: {
      labelKey: "exampleReadme",
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
      labelKey: "exampleMinimization",
      optimization: "min",
      numVars: 2,
      numConstraints: 1,
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: ">=", rhs: 4 }],
    },
    ge: {
      labelKey: "exampleGe",
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
      labelKey: "exampleEquality",
      optimization: "max",
      numVars: 2,
      numConstraints: 1,
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: "==", rhs: 4 }],
    },
    mixed: {
      labelKey: "exampleMixed",
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
      labelKey: "exampleNegativeRhs",
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
      labelKey: "exampleInfeasible",
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
      labelKey: "exampleUnbounded",
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
      labelKey: "exampleDecimal",
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

  let lang = "en";
  let lastSolvePayload = null;
  let lastSolveResult = null;

  const els = {
    pageTitle: document.getElementById("page-title"),
    pageSubtitle: document.getElementById("page-subtitle"),
    pageIdentity: document.getElementById("page-identity"),
    pageFooter: document.getElementById("page-footer"),
    langEn: document.getElementById("lang-en"),
    langFa: document.getElementById("lang-fa"),
    numVars: document.getElementById("num-vars"),
    numConstraints: document.getElementById("num-constraints"),
    objectiveGrid: document.getElementById("objective-grid"),
    constraintGrid: document.getElementById("constraint-grid"),
    problemPreview: document.getElementById("problem-preview"),
    statusBox: document.getElementById("status-box"),
    resultSummary: document.getElementById("result-summary"),
    feasibleViz: document.getElementById("feasible-region-viz"),
    feasibleNote: document.getElementById("feasible-region-note"),
    iterationControls: document.getElementById("iteration-controls"),
    expandAllBtn: document.getElementById("expand-all-btn"),
    collapseAllBtn: document.getElementById("collapse-all-btn"),
    stepsContainer: document.getElementById("steps-container"),
    exampleSelect: document.getElementById("example-select"),
    solveBtn: document.getElementById("solve-btn"),
    newProblemBtn: document.getElementById("new-problem-btn"),
    loadExampleBtn: document.getElementById("load-example-btn"),
  };

  function t(key) {
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }

  function translateErrorMessage(data) {
    if (!data) {
      return t("unknownError");
    }
    const key = ERROR_STATUS_KEYS[data.status];
    if (key && I18N[lang][key]) {
      return t(key);
    }
    return data.message || t("unknownError");
  }

  function setLanguage(nextLang) {
    lang = nextLang === "fa" ? "fa" : "en";
    document.documentElement.lang = lang === "fa" ? "fa" : "en";
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
    els.langEn.classList.toggle("active", lang === "en");
    els.langFa.classList.toggle("active", lang === "fa");
    els.langEn.setAttribute("aria-pressed", lang === "en" ? "true" : "false");
    els.langFa.setAttribute("aria-pressed", lang === "fa" ? "true" : "false");
    document.title = t("pageTitle");
    els.pageTitle.textContent = t("pageTitle");
    els.pageSubtitle.textContent = t("pageSubtitle");
    els.pageIdentity.innerHTML = t("identityHtml");
    els.pageFooter.textContent = t("footer");
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    populateExampleSelect();
    renderGridsLabels();
    updateProblemPreview();
    if (lastSolveResult) {
      renderResult(lastSolveResult, lastSolvePayload);
    } else {
      renderFeasibleRegion(null, collectPayload());
    }
  }

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

  function renderGridsLabels() {
    const objectiveLabel = els.objectiveGrid.querySelector(".row-label");
    if (objectiveLabel) {
      objectiveLabel.textContent = t("objective");
    }
    const opHeader = els.constraintGrid.querySelector("thead th:nth-last-child(2)");
    const rhsHeader = els.constraintGrid.querySelector("thead th:last-child");
    if (opHeader) {
      opHeader.textContent = t("operator");
    }
    if (rhsHeader) {
      rhsHeader.textContent = t("rhs");
    }
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
    label.textContent = t("objective");
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
    ["operator", "rhs"].forEach((labelKey) => {
      const th = document.createElement("th");
      th.textContent = t(labelKey);
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
    const dir = payload.optimization === "max" ? t("maxVerb") : t("minVerb");
    const lines = [`${dir} Z = ${formatObjectiveExpression(payload.objective)}`, "", t("constraintsLabel")];
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
    lastSolveResult = null;
    clearResults(t("formReset"));
    updateProblemPreview();
  }

  function clearResults(message) {
    els.statusBox.textContent = message || "";
    els.statusBox.className = "";
    els.resultSummary.innerHTML = `<p class="empty-state">${t("noResults")}</p>`;
    els.stepsContainer.innerHTML = "";
    els.iterationControls.hidden = true;
    renderFeasibleRegion(null, collectPayload());
  }

  function renderTableau(tableau) {
    if (!tableau || !tableau.length) {
      return `<p class="empty-state">${t("unknownError")}</p>`;
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

  function phaseLabel(phase) {
    return phase === "phase_one" ? t("phaseOne") : t("phaseTwo");
  }

  function setIterationControlsVisible(visible) {
    els.iterationControls.hidden = !visible;
    els.expandAllBtn.disabled = !visible;
    els.collapseAllBtn.disabled = !visible;
  }

  function renderSteps(steps) {
    els.stepsContainer.innerHTML = "";
    if (!steps || !steps.length) {
      setIterationControlsVisible(false);
      return;
    }
    setIterationControlsVisible(true);
    steps.forEach((step) => {
      const details = document.createElement("details");
      details.className = "step-panel";
      const phase = step.phase || "phase_two";
      const phaseIter = step.phase_iteration || step.index;
      const summary = document.createElement("summary");
      const badge = document.createElement("span");
      badge.className = `phase-badge ${phase}`;
      badge.textContent = phase === "phase_one" ? t("phaseOne") : t("phaseTwo");
      summary.appendChild(badge);
      const text = document.createElement("span");
      text.textContent = t("stepEnterLeave")
        .replace("{index}", String(step.index))
        .replace("{phase}", phaseLabel(phase))
        .replace("{phaseIter}", String(phaseIter))
        .replace("{enter}", step.enter || "—")
        .replace("{leave}", step.leave || "—");
      summary.appendChild(text);
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
    lastSolveResult = data;
    lastSolvePayload = payload || collectPayload();

    if (!data.ok) {
      const message = translateErrorMessage(data);
      els.statusBox.textContent = message;
      els.statusBox.className = "error";
      els.resultSummary.innerHTML = `
        <p><strong>${t("status")}:</strong> ${data.status || "error"}</p>
        <p>${message}</p>
      `;
      els.stepsContainer.innerHTML = "";
      setIterationControlsVisible(false);
      renderFeasibleRegion(data, lastSolvePayload);
      return;
    }

    els.statusBox.textContent = t("optimal");
    els.statusBox.className = "ok";

    const vars = Object.entries(data.variable_values || {})
      .map(([name, value]) => `${name} = ${formatNumber(value)}`)
      .join(", ");

    const phaseCounts = data.phase_counts || {
      phase_one: 0,
      phase_two: data.step_count || 0,
      total: data.step_count || 0,
    };

    els.resultSummary.innerHTML = `
      <p><strong>${t("status")}:</strong> ${t("optimal")}</p>
      <p><strong>${t("objectiveValue")}:</strong> ${formatNumber(data.objective_value)}</p>
      <p><strong>${t("decisionVariablesResult")}:</strong> ${vars || "—"}</p>
      <p><strong>${t("phaseOneIterations")}:</strong> ${phaseCounts.phase_one}</p>
      <p><strong>${t("phaseTwoIterations")}:</strong> ${phaseCounts.phase_two}</p>
      <p><strong>${t("totalIterations")}:</strong> ${phaseCounts.total}</p>
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
      if (row.operator === "==" ) {
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
    els.feasibleViz.setAttribute("aria-label", t("chartAriaLabel"));

    if (payload.objective.length !== 2) {
      els.feasibleViz.innerHTML = `<p class="viz-message">${t("vizUnavailable")}</p>`;
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
      note = t("noFeasibleRegion");
    } else if (result && !result.ok && result.status === "unbounded") {
      note = t("unboundedNotice");
    }

    const hasEquality = payload.constraints.some((row) => row.operator === "==");
    const polygon = buildFeasiblePolygon(payload, viewport);
    const area = polygonArea(polygon);
    const showFill = area > EPS && !(result && !result.ok && result.status === "infeasible");

    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${t("chartAriaLabel")}" xmlns="http://www.w3.org/2000/svg">`;
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
      svg += `<text x="${toSvgX(optimalPoint.x) + 8}" y="${toSvgY(optimalPoint.y) - 8}" font-size="11" fill="#1f7a4d">${t("optimalPoint")} (${formatNumber(optimalPoint.x)}, ${formatNumber(optimalPoint.y)})</text>`;
    }

    svg += `<text x="${pad}" y="18" font-size="11" fill="#475569">${t("legendConstraints")}</text>`;
    svg += "</svg>";

    els.feasibleViz.innerHTML = svg;

    if (note) {
      els.feasibleNote.hidden = false;
      els.feasibleNote.textContent = note;
    } else if (hasEquality && area <= EPS) {
      els.feasibleNote.hidden = false;
      els.feasibleNote.textContent = t("equalityNote");
    } else if (result && !result.ok && result.status === "unbounded") {
      els.feasibleNote.hidden = false;
      els.feasibleNote.textContent = t("unboundedNotice");
    }
  }

  async function solve() {
    clearResults(t("solving"));
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
      lastSolveResult = null;
      els.statusBox.textContent = t("networkError");
      els.statusBox.className = "error";
      els.resultSummary.innerHTML = `<p>${error.message}</p>`;
      renderFeasibleRegion(null, payload);
    }
  }

  function populateExampleSelect() {
    const current = els.exampleSelect.value || "readme";
    els.exampleSelect.innerHTML = "";
    Object.entries(EXAMPLES).forEach(([key, example]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = t(example.labelKey);
      els.exampleSelect.appendChild(option);
    });
    els.exampleSelect.value = current;
  }

  function expandAllSteps() {
    els.stepsContainer.querySelectorAll("details.step-panel").forEach((panel) => {
      panel.open = true;
      const summary = panel.querySelector("summary");
      if (summary) {
        summary.setAttribute("aria-expanded", "true");
      }
    });
  }

  function collapseAllSteps() {
    els.stepsContainer.querySelectorAll("details.step-panel").forEach((panel) => {
      panel.open = false;
      const summary = panel.querySelector("summary");
      if (summary) {
        summary.setAttribute("aria-expanded", "false");
      }
    });
  }

  els.numVars.addEventListener("change", rebuildGrids);
  els.numConstraints.addEventListener("change", rebuildGrids);
  els.solveBtn.addEventListener("click", solve);
  els.newProblemBtn.addEventListener("click", resetNewProblem);
  els.loadExampleBtn.addEventListener("click", () => {
    loadExample(els.exampleSelect.value);
  });
  els.langEn.addEventListener("click", () => setLanguage("en"));
  els.langFa.addEventListener("click", () => setLanguage("fa"));
  els.expandAllBtn.addEventListener("click", expandAllSteps);
  els.collapseAllBtn.addEventListener("click", collapseAllSteps);
  document.querySelectorAll('input[name="optimization"]').forEach((input) => {
    input.addEventListener("change", updateProblemPreview);
  });

  populateExampleSelect();
  loadExample("readme");
  setLanguage("en");

  window.__saproUi = {
    buildProblemPreviewText,
    formatObjectiveExpression,
    formatTerm,
    buildFeasiblePolygon,
    polygonArea,
    computeViewport,
    EXAMPLES,
    I18N,
    setLanguage,
    collectPayload,
    resetNewProblem,
    expandAllSteps,
    collapseAllSteps,
    renderFeasibleRegion,
  };
})();
