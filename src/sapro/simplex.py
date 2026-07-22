from numbers import Real
from .algebra import *
from .error import *
from .tableau import Tableau
from .utils import ftoa
from dataclasses import dataclass
from io import StringIO
from typing import Sequence, Iterator, Generator, TypedDict
import numpy as np

__all__ = [
    'LPStep', 'ExtraData', 'LPResult', 'FormattedConstraint', 'Simplex',
    'DEFAULT_EPSILON', 'DEFAULT_MAX_ITERATIONS',
]

DEFAULT_EPSILON = 1e-9
DEFAULT_MAX_ITERATIONS = 10_000

class FormattedConstraint(TypedDict):
    '''
    Represents a formatted constraint as in `Simplex.format_constraints`.
    '''
    coefficients: dict[Variable, str]
    'Variable -> coefficient mapping.'
    rhs: str
    'Right-hand side value.'
    operator: OperatorType
    'Operator (eq, le, ge).'

@dataclass
class LPStep:
    'Step of a LP problem.'

    tableau: Tableau
    'Simplex tableau.'
    enter: Variable | None
    'Variable becoming base during this step.'
    leave: Variable | None
    'Variable leaving base during this step.'

class ExtraData(TypedDict, total=False):
    'Extra data as in `LPResult.extra_data`.'

    removed_constraints: list[Constraint]
    'Removed constraints in two-phase algorithm.'
    formatted_removed_constraints: list[FormattedConstraint]
    'Formatted version of `removed_constraints`.'

@dataclass
class LPResult:
    'Result of a LP problem.'

    target_value: float
    'Minimized / Maximized target value `CT @ X`.'
    variable_values: dict[Variable, float]
    'Values of variables when the target value is reached.'
    base_variables: list[Variable]
    'Base variables selected.'
    precision: int | None
    'Precision when displaying. `None` for fraction display.'
    extra_data: ExtraData | None = None
    'Extra data e.g. `removed_constraints`.'
    @property
    def formatted_target_value(self) -> str:
        '''
        Returns a formatted version of `self.target_value`.

        Returns
        -------
        A formatted version of `self.target_value`.
        '''
        return ftoa(self.target_value, self.precision)
    @property
    def formatted_variable_values(self) -> dict[Variable, str]:
        '''
        Returns a formatted version of `self.variable_values`.

        Returns
        -------
        A dictionary like `self.variable_values`, but with every value formatted.
        '''
        return { var: ftoa(value, self.precision) for var, value in self.variable_values.items() }
    def display(self) -> str:
        '''
        Converts this object to a readable format.

        Returns
        -------
        string:
            A readable string.
            Format: `{target_value} when {var_name} = {var_value}, ...`
        '''
        result = StringIO()
        result.write(ftoa(self.target_value, self.precision))
        result.write(' when ')
        for var, value in self.variable_values.items():
            result.write(str(var))
            result.write(' = ')
            result.write(ftoa(value, self.precision))
            result.write(', ')
        return result.getvalue().rstrip(', ')
    def __str__(self):
        return self.display()

class Simplex:
    '''
    Solve LP problem using the Simplex Algorithm.

    Example
    -------
    >>> from variable import *
    >>> x = Variable.sequence('x')
    >>> x1, x2 = next(x), next(x)
    >>> problem = Simplex(
    ...     # max
    ...     x1 + 2 * x2,
    ...     # s.t.
    ...     x1 + x2 <= 4,
    ...     -2*x1 + x2 <= 1,
    ...     x1 <= 3,
    ...     maximize=True,
    ...     slack_var_generator=x
    ... )
    >>> steps = list(problem.solve()) # consumes the iterator
    >>> str(problem.result)
    "7 when x1 = 1, x2 = 3, x3 = 0, x4 = 0, x5 = 2"
    >>> problem.result.target_value
    7
    >>> problem.result.variable_values[x2]
    3
    '''

    target: Expression
    'The target expression in a LP problem.'
    constraints: list[Constraint]
    'List of constraints in a LP problem.'
    variables: list[Variable]
    'List of all variables used.'
    base_vars: list[Variable] | None
    'List of base variables.'
    maximize: bool
    'If `True`, the target will be maximized instead of minimized.'
    slack_var_generator: Iterator[Variable]
    'A iterator (has a `next` method) to generate slack variable.'
    result: LPResult | None
    'Result of the last operation.'

    def __init__(self,
                 target: Expression,
                 *constraints: Constraint,
                 vs: Sequence[Variable] | None = None,
                 bvs: Sequence[Variable] | None = None,
                 maximize: bool = False,
                 slack_var_generator: Iterator[Variable] | None = None,
                 slack_var_prefix: str = 's',
                 epsilon: float = DEFAULT_EPSILON,
                 max_iterations: int = DEFAULT_MAX_ITERATIONS,
                 auto_two_phase: bool = True):
        '''
        Initializes Simplex Algorithm.

        Parameters
        ----------
        target: Expression
            The target expression in a LP problem.
        constraints: tuple[Constraint]
            List of constraints in a LP problem.
        vs:
            List of all variables used.
            If `None`, variables will be extracted from provided constraints.
        bvs:
            List of initial base variables.
            If `None`, slack variables will be used if sufficient, otherwise
            an Exception will be raised.
            The `two_phase` method can be used to determine base variables.
        maximize:
            If `True`, the target will be maximized instead of minimized.
        slack_var_generator:
            A iterator (has a `next` method) to generate slack variable.
            If `None`, `Variable.sequence(slack_var_prefix)` will be used.
        slack_var_prefix:
            Prefix when generating slack variables.
            Ignored if `slack_var_generator` is specified.
        epsilon:
            Numerical tolerance for pivot and optimality comparisons.
        max_iterations:
            Maximum pivot operations allowed per ``two_phase`` (Phase I) or
            ``solve`` (Phase II primal plus dual repair) invocation.
        auto_two_phase:
            When ``True``, ``solve()`` automatically runs Phase I if the
            canonical problem has no complete unit-slack (or surplus) basis.
        '''
        self.epsilon = self._validate_epsilon(epsilon)
        self.max_iterations = self._validate_max_iterations(max_iterations)
        self.auto_two_phase = self._validate_auto_two_phase(auto_two_phase)
        self.target = target
        self.constraints = list(constraints)
        self.base_vars = None if bvs is None else list(bvs)
        self.maximize = maximize
        self.slack_var_generator = slack_var_generator or Variable.sequence(slack_var_prefix)
        self.result = None
        self._num_slack_vars = 0
        self._rhs_normalized = False
        self._slack_canonicalized = False
        self._phase_one_done = False
        if vs is None:
            variables = set()
            for c in constraints:
                variables |= c.variables
            self.variables = sorted(variables, key=lambda v: v.name)
        else:
            self.variables = list(vs)
    def display(self) -> str:
        '''
        Produces a mathematical expression of the LP problem given.

        Returns
        -------
        expr:
            A mathematical expression.

        Example
        -------
        >>> problem = Simplex(
        ...     # max
        ...     x1 + 2 * x2,
        ...     # s.t.
        ...     x1 + x2 <= 4,
        ...     -2*x1 + x2 <= 1,
        ...     x1 <= 3,
        ...     maximize=True,
        ...     slack_var_generator=x
        ... )
        >>> print(problem.display())
        max  x1 + 2x2
        s.t. x1 + x2 <= 4
             -2x1 + x2 <= 1
             x1 <= 3
        '''
        result = StringIO()
        if self.maximize:
            result.write('max  ')
        else:
            result.write('min  ')
        print(self.target, file=result)
        for i, c in enumerate(self.constraints):
            if i == 0:
                print('s.t.', c, file=result)
            else:
                print('    ', c, file=result)
        return result.getvalue().rstrip()
    def __str__(self):
        return self.display()
    def __repr__(self):
        return 'Simplex({}, {})'.format(len(self.variables), len(self.constraints))
    @staticmethod
    def _validate_epsilon(epsilon: float) -> float:
        epsilon = float(epsilon)
        if not np.isfinite(epsilon):
            raise ValueError('epsilon must be finite')
        if epsilon <= 0:
            raise ValueError('epsilon must be positive')
        return epsilon
    @staticmethod
    def _validate_max_iterations(max_iterations: int) -> int:
        if isinstance(max_iterations, bool):
            raise ValueError('max_iterations must be a positive integer')
        if type(max_iterations) is not int:
            raise ValueError('max_iterations must be a positive integer')
        if max_iterations <= 0:
            raise ValueError('max_iterations must be a positive integer')
        return max_iterations
    @staticmethod
    def _validate_auto_two_phase(auto_two_phase: bool) -> bool:
        if type(auto_two_phase) is not bool:
            raise ValueError('auto_two_phase must be a boolean')
        return auto_two_phase
    def _requires_phase_one(self) -> bool:
        '''
        Return whether Phase I is needed before Phase II.

        Phase I is required when no caller-provided basis exists and
        canonicalization introduces fewer slack/surplus variables than
        constraints (typically because of equality rows). All-``<=`` models
        and other cases with one slack or surplus column per row already
        have a square structural basis and skip Phase I.
        '''
        if self._phase_one_done:
            return False
        if self.base_vars is not None:
            return False
        self._ensure_normalized_rhs()
        self.canonicalize()
        M = len(self.constraints)
        if M <= 0:
            return False
        return self._num_slack_vars != M
    def _check_pivot_limit(self, phase: str, completed_pivots: int) -> None:
        '''
        Raise ``IterationLimit`` before starting pivot ``completed_pivots + 1``.

        Each ``two_phase`` and ``solve`` call uses a fresh local pivot counter.
        Initial tableau construction is not counted.
        '''
        if completed_pivots >= self.max_iterations:
            raise IterationLimit(
                f'{phase} exceeded iteration limit after {completed_pivots} '
                f'pivots (max_iterations={self.max_iterations})'
            )
    def _is_zero(self, value: Real) -> bool:
        return abs(float(value)) <= self.epsilon
    def _is_positive(self, value: Real) -> bool:
        return float(value) > self.epsilon
    def _is_negative(self, value: Real) -> bool:
        return float(value) < -self.epsilon
    def _clean_near_zero(self, array: np.ndarray) -> None:
        array[np.abs(array) <= self.epsilon] = 0.0
    def _ensure_finite(self, value: Real, message: str) -> float:
        value = float(value)
        if not np.isfinite(value):
            raise NumericalFailure(message)
        return value
    def _ensure_finite_array(self, array: np.ndarray, message: str) -> None:
        if not np.all(np.isfinite(array)):
            raise NumericalFailure(message)
    def _ensure_no_nan_array(self, array: np.ndarray, message: str) -> None:
        if np.any(np.isnan(array)):
            raise NumericalFailure(message)
    def _select_entering_var(self, sigma: np.ndarray, maximize: bool) -> int | None:
        '''
        Selects a variable to become base.

        Parameters
        ---------
        sigma:
            The checksum array.
        arbitrary:
            If `True`, just pick a non-zero element regardless of `self.maximize`.
            Used in method `two_phase`.
        
        Returns
        -------
        index:
            Index of the selected variable. `None` if none available.
        '''
        if maximize:
            candidates = np.array([
                i for i, value in enumerate(sigma) if self._is_positive(value)
            ], dtype=int)
        else:
            candidates = np.array([
                i for i, value in enumerate(sigma) if self._is_negative(value)
            ], dtype=int)
        return int(candidates[0]) if candidates.shape[0] > 0 else None
    def _select_leaving_var(self, rhs: np.ndarray) -> int | None:
        '''
        Selects a variable to leave base.

        Parameters
        ----------
        rhs:
            The right-hand side array.
        
        Returns
        -------
        index:
            Index of the selected variable. `None` if none available.
        '''
        candidates = np.array([
            i for i, value in enumerate(rhs) if self._is_negative(value)
        ], dtype=int)
        return int(candidates[0]) if candidates.shape[0] > 0 else None
    def _ensure_normalized_rhs(self):
        '''
        Normalize constraint RHS values to be nonnegative before introducing
        slack, surplus, or artificial variables.
        '''
        if self._rhs_normalized:
            return
        self.constraints = [
            normalize_constraint_rhs(c) for c in self.constraints
        ]
        self._rhs_normalized = True
    def _primal_ratio_test(
        self,
        data: np.ndarray,
        rhs: np.ndarray,
        enter_index: int,
    ) -> tuple[int | None, np.ndarray]:
        '''
        Minimum ratio test for a primal simplex pivot column.

        Returns ``(leave_index, ratios)``. ``leave_index`` is ``None`` when the
        problem is unbounded in the entering direction.
        '''
        if enter_index < 0 or enter_index >= data.shape[1]:
            raise NumericalFailure('entering column index out of bounds')
        pivot_col = data[:, enter_index]
        positive_mask = np.array([self._is_positive(value) for value in pivot_col])
        with np.errstate(divide='ignore', invalid='ignore'):
            ratios = np.where(
                positive_mask,
                rhs / pivot_col,
                np.inf,
            )
        self._ensure_no_nan_array(ratios, 'ratio test produced non-finite values')
        if not np.any(np.isfinite(ratios)):
            return None, ratios
        leave_index = int(np.argmin(ratios))
        pivot = self._ensure_finite(
            data[leave_index, enter_index],
            'pivot element is not finite',
        )
        if self._is_zero(pivot):
            raise NumericalFailure('pivot element is too close to zero')
        if not self._is_positive(pivot):
            return None, ratios
        return leave_index, ratios
    def _apply_pivot(
        self,
        data: np.ndarray,
        sigma: np.ndarray,
        rhs: np.ndarray,
        enter_index: int,
        leave_index: int,
        M: int,
    ) -> float:
        '''
        Apply a pivot on ``(leave_index, enter_index)`` and return the updated z.
        Caller must update ``z`` separately using the returned row operations.
        '''
        if not (0 <= leave_index < M and 0 <= enter_index < data.shape[1]):
            raise NumericalFailure('pivot indices out of bounds')
        pivot = self._ensure_finite(
            data[leave_index, enter_index],
            'pivot element is not finite',
        )
        if self._is_zero(pivot):
            raise NumericalFailure('pivot element is too close to zero')
        if not self._is_positive(pivot):
            raise NumericalFailure('pivot element must be positive')
        rhs[leave_index] /= pivot
        data[leave_index] /= pivot
        for i in range(M):
            if i == leave_index:
                continue
            if self._is_zero(data[i, enter_index]):
                continue
            rhs[i] -= rhs[leave_index] * data[i, enter_index]
            data[i] -= data[leave_index] * data[i][enter_index]
        pivot_entry = self._ensure_finite(
            data[leave_index, enter_index],
            'normalized pivot element is not finite',
        )
        ratio = self._ensure_finite(
            sigma[enter_index] / pivot_entry,
            'sigma update ratio is not finite',
        )
        sigma -= data[leave_index] * ratio
        self._clean_near_zero(data)
        self._clean_near_zero(sigma)
        self._clean_near_zero(rhs)
        self._ensure_finite_array(data, 'tableau became non-finite after pivot')
        self._ensure_finite_array(sigma, 'reduced costs became non-finite after pivot')
        self._ensure_finite_array(rhs, 'rhs became non-finite after pivot')
        return ratio
    def _check_cycle(self, base_vars: list[Variable], base_var_memo: set[frozenset[Variable]]):
        base_var_set = frozenset(base_vars)
        if base_var_set in base_var_memo:
            raise Cycle('encountered cycle in simplex')
        base_var_memo.add(base_var_set)
    def canonicalize(self) -> int:
        '''
        Canonicalizes all constraints using slack variables from `self.slack_var_generator`.

        Returns
        -------
        num_slack_vars:
            Number of slack variables used.
        '''
        self._ensure_normalized_rhs()
        if self._slack_canonicalized:
            return self._num_slack_vars
        for c in self.constraints:
            if not c.is_canonical:
                self._num_slack_vars += 1
                v = next(self.slack_var_generator)
                c.canonicalize(v)
                self.variables.append(v)
        self._slack_canonicalized = True
        return self._num_slack_vars
    def format_constraints(self, precision: int | None = None) -> list[FormattedConstraint]:
        '''
        Formats the coefficients in constraints.

        Parameters
        ----------
        precision:
            Number of digits after the floating point.
            If `None` or negative, fractions will be used.
        
        Returns
        -------
        formatted_constraints:
            The formatted constraints.
        '''
        return [
            {
                "coefficients": { var: ftoa(coef, precision) for var, coef in c.coefficients.items() },
                "rhs": ftoa(c.rhs, precision),
                "operator": c.operator
            }
            for c in self.constraints
        ]
    def _prepare(self, need_base_vars: bool):
        '''
        Prepares for simplex iterations.
        Calls `canonicalize` and checks the number of base variables.

        Raises
        ------
        sapro.error.InvalidBase:
            Raised if one of the following occurs:
            - No bases variables set, and the number of slack variables doesn't match the number of constraints.
            - The number of base variables doesn't match the number of constraints.
        '''
        self.canonicalize()
        # check variables
        M = len(self.constraints)
        if M <= 0:
            raise Unsolvable('constraints is empty')
        if not need_base_vars:
            return
        if self.base_vars is None:
            if self._num_slack_vars == M:
                self.base_vars = self.variables[-M:]
            else:
                raise InvalidBase('cannot determine base variables')
        elif len(self.base_vars) != len(self.constraints):
            raise InvalidBase('number of base variables doesn\'t match number of constraints')
    def _prepare_phase_two(self):
        '''
        Validate state after a successful ``two_phase`` call before Phase II.

        Skips slack introduction because constraints are already in canonical
        form and ``self.base_vars`` holds the Phase I feasible basis.
        '''
        self._ensure_normalized_rhs()
        M = len(self.constraints)
        if M <= 0:
            raise Unsolvable('constraints is empty')
        if self.base_vars is None:
            raise InvalidBase('cannot determine base variables')
        if len(self.base_vars) != M:
            raise InvalidBase('number of base variables doesn\'t match number of constraints')
        for base_var in self.base_vars:
            if base_var not in self.variables:
                raise InvalidBase(f'base variable {base_var!s} is not in the problem')
    def _init_matrices(self,
                       constraints: Sequence[Constraint], 
                       variables: Sequence[Variable], 
                       target: Expression, 
                       base_vars: Sequence[Variable]) -> tuple[np.ndarray, ...]:
        '''
        Initialize `data`, `sigma`, `rhs` and `z` values.

        Parameters
        ----------
        constraints:
            A sequence of constraints.
        variables:
            A sequence of all variables.
        target:
            The target expression.
        base_vars:
            A sequence of base variables.
        
        Returns
        -------
        data, sigma, rhs, z:
            Initialized values.    
        '''

        # check variables
        M = len(constraints)
        N = len(variables)

        # initialize Ax = b, z = cTx matrices
        A = np.zeros((M, N))
        b = np.zeros(M)
        cT = np.zeros(N)
        for i, c in enumerate(constraints):
            for var, coef in c.coefficients.items():
                A[i][variables.index(var)] = coef
            b[i] = c.rhs
        for var, coef in target.coefficients.items():
            cT[variables.index(var)] = coef
        
        # initialize AB, AN, cTB, cTN matrices
        base_indices = [variables.index(base_var) for base_var in base_vars]
        non_base_indices = [i for i in range(N) if i not in base_indices]
        AB = A[:, base_indices]
        AN = A[:, non_base_indices]
        cTB = cT[base_indices]
        cTN = cT[non_base_indices]

        # initialize data, sigma, rhs and z
        ABinv = np.linalg.inv(AB)
        if not np.all(np.isfinite(ABinv)):
            raise NumericalFailure('basis matrix inversion produced non-finite values')
        ABinvAN = ABinv @ AN
        data = np.zeros((M, N))
        data[:, base_indices] = np.eye(M)
        data[:, non_base_indices] = ABinvAN
        sigma = np.zeros(N)
        sigma[non_base_indices] = cTN - cTB @ ABinvAN
        rhs = ABinv @ b
        z = -cTB @ rhs
        self._clean_near_zero(data)
        self._clean_near_zero(sigma)
        self._clean_near_zero(rhs)
        z = self._ensure_finite(z, 'objective value is not finite after initialization')
        self._ensure_finite_array(data, 'tableau is not finite after initialization')
        self._ensure_finite_array(sigma, 'reduced costs are not finite after initialization')
        self._ensure_finite_array(rhs, 'rhs is not finite after initialization')

        return data, sigma, rhs, z
    def set_base_vars(self, base_vars: Sequence[Variable] | None):
        '''
        Sets the base variables before solving.

        Parameters
        ----------
        base_vars:
            The base variable sequence.
        '''
        self.base_vars = base_vars
    def two_phase(self, 
                  yield_initial_tableau: bool = False, 
                  precision: int | None = None, 
                  artificial_var_prefix: str = 'u') -> Generator[LPStep, None, None]:
        '''
        Calculates BFS (Basic Feasible Solution) using the Two-phase Algorithm.
        Sets `self.result` to the BFS.

        Parameters
        ----------
        yield_initial_tableau:
            If `True`, the initial tableau (before any variable enters) will be yielded.
        precision:
            The precision of the result when displayed.
            If `None`, display using closest fraction.
        artificial_var_prefix:
            Prefix when generating artificial variables.

        Raises
        ------
        sapro.error.InvalidBase:
            Raised if one of the following occurs:
            - No bases variables set, and the number of slack variables doesn't match the number of constraints.
            - The number of base variables doesn't match the number of constraints.
        sapro.error.BaseAlreadySet:
            If base variables are already set.
        sapro.error.Cycle:
            If cycles appear while iterating.
        sapro.error.IterationLimit:
            If Phase I exceeds ``max_iterations`` pivot operations.
        
        Returns
        -------
        tableau_gen:
            A generator, which yields at each algorithm step with the simplex table.
        '''
        self._prepare(False)
        if self.base_vars is not None:
            raise BaseAlreadySet('base variables already set')
        self._phase_one_done = False
        artificial_vars = list(Variable.sequence(artificial_var_prefix, len(self.constraints)))
        base_vars = artificial_vars.copy()
        variables = self.variables.copy()
        variables.extend(artificial_vars)

        M = len(self.constraints)

        constraints = []
        for c, avar in zip(self.constraints, artificial_vars):
            coefs = c.coefficients.copy()
            coefs[avar] = 1
            constraints.append(Constraint(coefs, c.rhs, c.operator))

        data, sigma, rhs, z = self._init_matrices(
            constraints,
            variables,
            Expression(dict.fromkeys(artificial_vars, 1)),
            base_vars
        )

        if yield_initial_tableau:
            yield LPStep(
                tableau=Tableau(
                    data.copy(),
                    sigma.copy(),
                    rhs.copy(),
                    z,
                    variables.copy(),
                    base_vars.copy(),
                    precision=precision
                ),
                enter=None,
                leave=None
            )
        
        base_var_memo = set()
        base_var_memo.add(frozenset(base_vars))
        pivot_count = 0

        # algorithm step
        while True:
            enter_index = self._select_entering_var(sigma[:-M], False)
            if enter_index is None:
                break
            self._check_pivot_limit('Phase I', pivot_count)
            leave_index, _ratios = self._primal_ratio_test(data, rhs, enter_index)
            if leave_index is None:
                raise Boundless('unbounded problem')
            leave_var = base_vars[leave_index]
            ratio = self._apply_pivot(data, sigma, rhs, enter_index, leave_index, M)
            z -= rhs[leave_index] * ratio
            base_vars[leave_index] = variables[enter_index]
            pivot_count += 1

            yield LPStep(
                tableau=Tableau(
                    data.copy(),
                    sigma.copy(),
                    rhs.copy(),
                    z,
                    variables.copy(),
                    base_vars.copy(),
                    precision=precision
                ),
                enter=variables[enter_index],
                leave=leave_var
            )

            self._check_cycle(base_vars, base_var_memo)
        
        if not self._is_zero(z) or any(self._is_negative(value) for value in rhs):
            raise Unsolvable('cannot find feasible solution')

        removed_constraints = []
        for avar in artificial_vars:
            if avar in base_vars:
                # useless constraint
                removed_constraints.append(
                    self.constraints.pop(base_vars.index(avar))
                )
                base_vars.remove(avar)
        self.set_base_vars(base_vars)
        self._phase_one_done = True

        cT = np.zeros(len(self.variables))
        for var, coef in self.target.coefficients.items():
            cT[self.variables.index(var)] = coef
        x = np.zeros(len(self.variables))
        for var, coef in zip(base_vars, rhs):
            x[self.variables.index(var)] = coef
        var_values = dict.fromkeys(variables, 0)
        var_values.update(zip(base_vars, rhs))
        # do not include artificial variables here.
        for avar in artificial_vars:
            del var_values[avar]
        self.result = LPResult(
            target_value=cT @ x,
            variable_values=var_values,
            precision=precision,
            base_variables=base_vars.copy(),
            extra_data={
                'removed_constraints': removed_constraints,
                'formatted_removed_constraints': [
                    {
                        "coefficients": { var: ftoa(coef, precision) for var, coef in c.coefficients.items() },
                        "rhs": ftoa(c.rhs, precision),
                        "operator": c.operator
                    }
                    for c in removed_constraints
                ]
            }
        )

    def solve(self, 
              yield_initial_tableau: bool = False, 
              precision: int | None = None) -> Generator[LPStep, None, None]:
        '''
        Calculates the best solution using the Simplex Algorithm.
        Sets `self.result` to the solution.

        Parameters
        ----------
        yield_initial_tableau:
            If `True`, the initial tableau (before any variable enters) will be yielded.
        precision:
            The precision of the result when displayed.
            If `None`, display using closest fraction.

        Raises
        ------
        sapro.error.InvalidBase:
            Raised if one of the following occurs:
            - No bases variables set, and the number of slack variables doesn't match the number of constraints.
            - The number of base variables doesn't match the number of constraints.
        sapro.error.Cycle:
            If cycles appear while iterating.
        sapro.error.IterationLimit:
            If Phase II exceeds ``max_iterations`` pivot operations.
        
        Returns
        -------
        tableau_gen:
            A generator, which yields at each algorithm step with the simplex table.
            When ``auto_two_phase`` is enabled and Phase I is required, Phase I
            steps are yielded first, followed by Phase II steps.
        '''
        if self.auto_two_phase and self._requires_phase_one():
            yield from self.two_phase(
                yield_initial_tableau=yield_initial_tableau,
                precision=precision,
            )

        self._prepare(True) if not self._phase_one_done else self._prepare_phase_two()

        # check variables
        M = len(self.constraints)

        # initialize matrices
        data, sigma, rhs, z = self._init_matrices(
            self.constraints,
            self.variables,
            self.target,
            self.base_vars
        )

        if yield_initial_tableau:
            yield LPStep(
                tableau=Tableau(
                    data.copy(),
                    sigma.copy(),
                    rhs.copy(),
                    z,
                    self.variables.copy(),
                    self.base_vars.copy(),
                    precision=precision
                ),
                enter=None,
                leave=None
            )
        
        base_var_memo = set()
        base_var_memo.add(frozenset(self.base_vars))
        pivot_count = 0

        # algorithm step
        while True:
            enter_index = self._select_entering_var(sigma, self.maximize)
            if enter_index is None:
                break
            self._check_pivot_limit('Phase II', pivot_count)
            leave_index, _ratios = self._primal_ratio_test(data, rhs, enter_index)
            if leave_index is None:
                raise Boundless('unbounded problem')
            leave_var = self.base_vars[leave_index]
            ratio = self._apply_pivot(data, sigma, rhs, enter_index, leave_index, M)
            z -= rhs[leave_index] * ratio
            self.base_vars[leave_index] = self.variables[enter_index]
            pivot_count += 1
            
            yield LPStep(
                tableau=Tableau(
                    data.copy(),
                    sigma.copy(),
                    rhs.copy(),
                    z,
                    self.variables.copy(),
                    self.base_vars.copy(),
                    precision=precision
                ),
                enter=self.variables[enter_index],
                leave=leave_var
            )

            self._check_cycle(self.base_vars, base_var_memo)

        base_var_memo.clear()
        while True:
            leave_index = self._select_leaving_var(rhs)
            if leave_index is None:
                break
            self._check_pivot_limit('Phase II dual repair', pivot_count)
            leave_var = self.base_vars[leave_index]
            enterable = np.array([
                self._is_negative(value) for value in data[leave_index]
            ])
            if not enterable.any():
                raise Unsolvable(f'cannot make "{leave_var}" leave base')
            with np.errstate(divide='ignore', invalid='ignore'):
                ratios = np.where(
                    enterable,
                    sigma / data[leave_index],
                    np.inf,
                )
            self._ensure_no_nan_array(ratios, 'dual ratio test produced non-finite values')
            enter_index = int(np.argmin(np.abs(ratios)))
            pivot = self._ensure_finite(
                data[leave_index, enter_index],
                'dual pivot element is not finite',
            )
            if self._is_zero(pivot):
                raise NumericalFailure('dual pivot element is too close to zero')
            rhs[leave_index] /= pivot
            data[leave_index] /= pivot
            for i in range(M):
                if i == leave_index:
                    continue
                if self._is_zero(data[i, enter_index]):
                    continue
                rhs[i] -= rhs[leave_index] * data[i, enter_index]
                data[i] -= data[leave_index] * data[i][enter_index]
            pivot_entry = self._ensure_finite(
                data[leave_index, enter_index],
                'normalized dual pivot element is not finite',
            )
            ratio = self._ensure_finite(
                sigma[enter_index] / pivot_entry,
                'dual sigma update ratio is not finite',
            )
            sigma -= data[leave_index] * ratio
            z = self._ensure_finite(
                z - rhs[leave_index] * ratio,
                'objective value is not finite after dual pivot',
            )
            self._clean_near_zero(data)
            self._clean_near_zero(sigma)
            self._clean_near_zero(rhs)
            self._ensure_finite_array(data, 'tableau became non-finite after dual pivot')
            self._ensure_finite_array(sigma, 'reduced costs became non-finite after dual pivot')
            self._ensure_finite_array(rhs, 'rhs became non-finite after dual pivot')
            self.base_vars[leave_index] = self.variables[enter_index]
            pivot_count += 1
            
            yield LPStep(
                tableau=Tableau(
                    data.copy(),
                    sigma.copy(),
                    rhs.copy(),
                    z,
                    self.variables.copy(),
                    self.base_vars.copy(),
                    precision=precision
                ),
                enter=self.variables[enter_index],
                leave=leave_var
            )

            self._check_cycle(self.base_vars, base_var_memo)
        
        var_values = dict.fromkeys(self.variables, 0)
        var_values.update(zip(self.base_vars, rhs))
        self.result = LPResult(
            target_value=-z,
            variable_values=var_values,
            base_variables=self.base_vars.copy(),
            precision=precision,
        )