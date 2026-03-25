import { Condition, LeafCondition, GroupCondition } from '../types/condition.types';
import { ExecutionContext } from '../types/workflow.types';
import { ExpressionResolver } from './ExpressionResolver';

export class ConditionEvaluator {
    private resolver: ExpressionResolver;

    constructor() {
        this.resolver = new ExpressionResolver();
    }

    evaluate(condition: Condition, context: ExecutionContext): boolean {
        if (condition.type === 'leaf') {
            return this.evaluateLeaf(condition, context);
        }
        return this.evaluateGroup(condition, context);
    }

    private evaluateLeaf(condition: LeafCondition, context: ExecutionContext): boolean {
        const left = this.resolver.resolve(condition.left, context);

        // Also resolve the right side so {{nodes.x.y}} expressions work there too.
        // Static values like "200" or "true" pass through resolve() unchanged.
        const rawRight = condition.right !== undefined && condition.right !== null
            ? condition.right
            : undefined;
        const right = rawRight !== undefined
            ? this.resolver.resolve(String(rawRight), context)
            : rawRight;

        switch (condition.operator) {
        // Use loose equality so number 42 == string "42" (common when comparing
        // a resolved numeric value against a user-typed comparison string).
        case 'eq':  return this.looseEqual(left, right);
        case 'neq': return !this.looseEqual(left, right);

        case 'gt':  return this.toNumber(left) > this.toNumber(right);
        case 'gte': return this.toNumber(left) >= this.toNumber(right);
        case 'lt':  return this.toNumber(left) < this.toNumber(right);
        case 'lte': return this.toNumber(left) <= this.toNumber(right);

        case 'contains':   return this.toString(left).includes(this.toString(right));
        case 'startsWith': return this.toString(left).startsWith(this.toString(right));
        case 'endsWith':   return this.toString(left).endsWith(this.toString(right));

        case 'isNull':    return left === null || left === undefined;
        case 'isNotNull': return left !== null && left !== undefined;

        default:
            throw new Error(`Unknown operator: ${condition.operator}`);
        }
    }

    // Equality that bridges the number/string gap produced by user-typed comparison
    // values: resolved number 42 should equal typed string "42".
    private looseEqual(a: unknown, b: unknown): boolean {
        if (a === b) return true;
        if (a == null || b == null) return false;
        // If either side is already a number, compare numerically when both are numeric
        if (typeof a === 'number' || typeof b === 'number') {
            const na = Number(a), nb = Number(b);
            if (!isNaN(na) && !isNaN(nb)) return na === nb;
        }
        return String(a) === String(b);
    }

    private evaluateGroup(condition: GroupCondition, context: ExecutionContext): boolean {
        const { operator, conditions } = condition;

        switch (operator) {
            case 'and':
                return conditions.every(c => this.evaluate(c, context));

            case 'or':
                return conditions.some(c => this.evaluate(c, context));

            case 'not':
                if (conditions.length !== 1) {
                    throw new Error(`"not" operator expects exactly 1 condition, got ${conditions.length}`);
                }
                return !this.evaluate(conditions[0], context);

            default:
                throw new Error(`Unknown logical operator: ${operator}`);
        }
    }

    private toNumber(value: unknown): number {
        const n = Number(value);
        if (isNaN(n)) throw new Error(`Cannot compare "${value}" as a number`);
        return n;
    }

    private toString(value: unknown): string {
        if (value === null || value === undefined) return '';
        return String(value);
    }
}