import { ActivitiesHubCard } from './ActivitiesHubCard';

export function ActivitiesHubGrid({ items, type }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="vd-grid vd-grid--3 activities-hub-grid">
      {items.map((item) => (
        <ActivitiesHubCard key={item.id} item={item} type={type} />
      ))}
    </div>
  );
}
