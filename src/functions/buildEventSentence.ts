export interface EventSentence {
    actor: string;
    action: string;
    tool?: string;
    target?: string;
    direction?: string;
}

export function thirdPerson(verb: string): string {
    const spaceIndex = verb.indexOf(' ');
    if (spaceIndex !== -1) {
        return thirdPerson(verb.slice(0, spaceIndex)) + verb.slice(spaceIndex);
    }
    if (/(?:s|sh|ch|x|z)$/.test(verb)) return verb + 'es';
    if (/[^aeiou]y$/.test(verb)) return verb.slice(0, -1) + 'ies';
    return verb + 's';
}

export function buildEventSentence({ actor, action, tool, target, direction }: EventSentence): string {
    let sentence = actor;
    if (tool) {
        sentence += ` uses ${tool} to ${action}`;
    } else {
        sentence += ` ${thirdPerson(action)}`;
    }
    if (target) sentence += ` ${target}`;
    if (direction) sentence += ` from the ${direction}`;
    return sentence;
}
