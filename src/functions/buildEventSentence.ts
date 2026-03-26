export interface EventSentence {
    actor: string;
    action: string;
    tool?: string;
    target?: string;
    direction?: string;
}

export function buildEventSentence({ actor, action, tool, target, direction }: EventSentence): string {
    let sentence = actor;
    if (tool) sentence += ` uses ${tool} to`;
    sentence += ` ${action}`;
    if (target) sentence += ` ${target}`;
    if (direction) sentence += ` from the ${direction}`;
    return sentence;
}
