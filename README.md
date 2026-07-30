<h1 align='center'>🪄Sapro</h1>
<p align='center'>Solve Linear Programming Problems using Simplex Algorithm.</p>

> ‼️This is a **demo** implementation of the *Simplex Algorithm*, homework of the *Operations Research* class. ***Bugs are expected***.‼️

## Installation

Install via PyPI:
```
$ pip install sapro==0.4.1b1
```

## CLI Usage

`sapro` exposes a command-line interface.
```
$ sapro solve --max x1+2*x2 \
    -c"x1+x2<=4" \
    -c"-2*x1+x2<=1" \
    -c"x1<=3" \
    --slack x3
z = 7 when x1 = 1, x2 = 3, x3 = 0, x4 = 0, x5 = 2
```

Run `sapro solve -h` for more info.

## GUI Usage

The offline web interface runs locally and does not require an internet connection. It assumes non-negative decision variables, and accepts Maximize, Minimize, `<=`, `>=`, and `=` constraints. Two-variable feasible-region visualization is available when exactly two decision variables are used.

Activate the project environment and launch the server:

```bash
source .venv/bin/activate
sapro webui --open
```

Then open:

```text
http://127.0.0.1:5678
```

`sapro` exposes a demo web GUI using `wsgiref`. To launch the WSGI server, use the following command:
```
$ sapro webui --open
Serving on 0.0.0.0:5678...
Press Ctrl+C to quit.
```

Open `http://localhost:5678` in your browser to use the interface.

## Static PWA (TypeScript / GitHub Pages)

The repository also contains a **browser-only Progressive Web App** under `web/`.
It runs the Simplex solver entirely in JavaScript, works offline after the first
visit, and is intended for hosting at:

```text
https://masoudvosoughii.github.io/sapro/
```

The Python GUI above remains the **legacy/reference desktop implementation** until
final project acceptance. It is not removed or deprecated in this branch.

### Local PWA development

```bash
cd web
npm ci
npm run dev
```

Open the URL shown by Vite (development base path `/`).

### Local production preview

```bash
cd web
npm ci
npm run build
npm run preview -- --host 127.0.0.1
```

Open `http://127.0.0.1:4173/sapro/`.

### Web tests

```bash
cd web
npm ci
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

If Playwright browser downloads fail because of regional CDN restrictions, retry
the official install command once. Do not permanently redirect CI to third-party
browser mirrors.

### PWA offline behavior

1. Build and preview (or deploy) the production site at `/sapro/`.
2. Open the app once while online so the service worker precaches assets.
3. The solver continues to work offline with no `/api/solve` request and no Python runtime.

Updates use a small in-app prompt. The page reloads only when you choose **Update**.

### GitHub Pages deployment (manual)

Deployment is **manual** while the PWA branch is under review:

1. Push the workflow on branch `feat/site-pwa`.
2. In GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Run **Actions → Deploy Sapro PWA to GitHub Pages → Run workflow** on branch `feat/site-pwa`.

Automatic deployment from the default branch (`simplex-project`) will be enabled
only after the PWA branch is accepted and merged.

The workflow runs Python tests, web tests, Playwright E2E, uploads only `web/dist`,
deploys to the `github-pages` environment, and runs post-deploy smoke checks against
the real hosted URL.

## Portable Windows build

The Windows desktop application is built through GitHub Actions and distributed as a ZIP archive. The ZIP does not require Python or an internet connection.

To obtain a build:

1. Open the repository on GitHub.
2. Go to **Actions** → **Build Windows Simplex Application**.
3. Click **Run workflow** and wait for the job to finish.
4. Download the **Simplex-Solver-Windows** artifact.

To use the downloaded build:

1. Extract the ZIP file.
2. Open the extracted folder.
3. Double-click `SimplexSolver.exe`.
4. Keep the console window open while using the application.
5. Close the console window when finished.

The application runs locally at `http://127.0.0.1:5678` by default and works fully offline. See `START_HERE.txt` in the distribution folder for the same instructions.

Developers can also run the portable launcher directly in Python:

```bash
python -m sapro.launcher
```

To use a custom host and port, specify the `-H` and `-p` arguments:
```
$ sapro webui -H 127.0.0.1 -p 8080
```

## API Usage

To use `sapro` in your program, you can import the `sapro` module.
```py
from sapro import *
```

### Variables

Variables are defined using the `Variable` class:
```py
x1 = Variable("x1")
```

I recommend using the same **python** variable name as the variable itself.

To conveniently define a series of variables e.g. $x_1$ ~ $x_4$ you can use the `sequence` method on `Variable`:
```py
x1, x2, x3, x4 = Variable.sequence('x', 4)
```

You can also omit the last parameter to create a "variable generator":
```py
x = Variable.sequence('x')
x1 = next(x)
x2 = next(x)
```

This is useful when you want to continue using the variable prefix for *slack variables*.

### Expressions

Expressions are created in a manner as if you are defining them in python:
```py
expr = -x1 + 2*x2
double_expr = 2 * expr
print(double_expr) # -2x1 + 4x2
```

Note that the multiplication sign (`*`) is omitted when printed, but is necessary in the expression definition.

Because this is a LP solver, only linear addition of the variables are allowed.

### Constraints

Constraints are created in a manner as if you are comparing an expression to a constant in python:
```py
cons = (-2*x1 + x2 <= 1)
print(cons) # -2x1 + x2 <= 1

cons.canonicalize(Variable("x3"))
print(cons) # -2x1 + x2 + x3 == 1
```

The right hand side of a constraint **must** be a single number. Only operators that permits equality are allowed (`<=`, `==` and `>=`).

### Define LP Problem

To define a LP problem, use the `Simplex` class.

Here is a simple LP problem. You can probably answer it in your head:

$$
\begin{aligned}
\max \space & x_1 + 2x_2 \\
\text{s.t.} \space & x_1 + x_2 \le 4, \\
& -2x_1 + x_2 \le 1, \\
& x_1 \le 3, \\
& x_i \ge 0, \space i = 1, 2, 3
\end{aligned}
$$

Its corresponding definition in python:
```py
x = Variable.sequence('x')
x1, x2 = next(x), next(x)

problem = Simplex(
    # max
    x1 + 2*x2,
    # s.t.
    x1 + x2 <= 4,
    -2*x1 + x2 <= 1,
    x1 >= 3,

    maximize=True,
    slack_var_generator=x
)
```

Pretty much the same, right? Here's what happened:

- The first positional argument is an expression of what the LP problem should optimize.
- The rest of the positional arguments are the constraints.
- `maximize=True` tells the algorithm to **maximize** instead of minimizing the target, which is the default behaviour.
- `slack_var_generator=x` tells the algorithm to continue using the generator `x` to generate slack variables. In this case, since `x1` and `x2` are consumed from the generator, slack variables will start their names from `x3`. If you omit this parameter, slack variables will have the prefix `s`, unless you specify the parameter `slack_var_prefix`.

The intrinsic bounds $x_i \ge 0$ always take effect. You don't need to explicitly specify them.

### Solving LP Problem

To solve a LP problem using simplex, the first thing to do is to determine the *base variables*. There are three ways to do this:

-   Select *slack variables* as base. This would be the most straightforward way for problems whose constraints are all **inequations**. After adding slack variables, their coefficient in the constraints are naturally 1 or -1, which composes an inversible matrix.
    
    No code is needed to use this method, as this is the default approach used by the algorithm. But you need to make sure that there is enough slack variables for the base i.e. all constraints are inequations.

-   Use the Two-Phase algorithm. This approach is suitable for normal LP problems.
    ```py
    from sapro.error import LPError

    try:
        # the method returns a generator
        # we need to consume all elements
        # to complete the algorithm
        list(problem.two_phase())
        print('feasible solution:')
        print(problem.result)
    except LPError as e:
        print('unsolvable problem:', e)
    ```

-   Manually specify the bases. Make sure the number of base variables matches the number of constraints.
    ```py
    problem.set_base_vars([x1, x2, x3]) # a list of variables
    ```

Now use the `solve` method to solve the problem:
```py
from sapro.error import LPError

try:
    # the method returns a generator
    # we need to consume all elements
    # to complete the algorithm
    list(problem.solve())
    print('best solution:')
    print(problem.result)
except LPError as e:
    print('unsolvable problem:', e)
```

### Per-Step Simplex Tableau

You may notice that we haven't used the generator returned by `Simplex.two_phase` and `Simplex.solve`. They yield `LPStep` objects, which has 3 fields:

- `tableau`: The simplex tableau after the current step.
- `enter`: The variable that became base.
- `leave`: The variable that left base.

Example of print the tableau:
```py
for i, step in enumerate(problem.solve()):
    print(f'Step {i+1}: ({step.enter} enters, {step.leave} leaves)')
    print(step.tableau)
```

If you pass `yield_initial_tableau=True` to either of the two methods, then a table containing the initial data will be yielded, before any variable has entered / left the base.

For more detailed usage, refer to the in-code documentations.
