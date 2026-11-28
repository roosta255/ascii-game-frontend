import { effectText, apCost, SERVER_ACTION_ROWS } from './actions';
import { HIDER_VIEW } from '../pages/hiderSeeker/testSupport';

describe('actions', () => {
  it('HSUI-190: effectText', () => {
    expect(effectText(HIDER_VIEW, 'SUPPRESS_ERROR')).toBe('errors \u221210');
    expect(effectText(HIDER_VIEW, 'BOOST_CPU')).toBe('cpu +15');
    expect(effectText(HIDER_VIEW, 'CONFIGURE_SERVER')).toBe('No visible effect');
    expect(effectText(HIDER_VIEW, 'PAY_GOAL')).toBe('Completes goal 1');
    expect(effectText({ ...HIDER_VIEW, completable_goal_id: null }, 'PAY_GOAL'))
      .toBe('No goal is ready: the AP is spent for nothing');
    expect(effectText(HIDER_VIEW, 'DISCONNECT')).toBe('Returns 1 connection to the team');
  });

  it('HSUI-190: no output mentions trace', () => {
    for (const type of Object.keys(HIDER_VIEW.rules.action_ap_costs)) {
      expect(effectText(HIDER_VIEW, type).toLowerCase()).not.toContain('trace');
    }
  });

  it('HSUI-190: apCost and the row order', () => {
    expect(apCost(HIDER_VIEW, 'BOOST_CPU')).toBe(2);
    expect(SERVER_ACTION_ROWS).toEqual(['CONFIGURE_SERVER', 'SUPPRESS_ERROR', 'BOOST_CPU', 'ROTATE_ROUTE', 'PAY_GOAL', 'DISCONNECT']);
  });
});