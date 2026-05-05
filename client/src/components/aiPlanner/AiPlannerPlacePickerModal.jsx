export default function AiPlannerPlacePickerModal({
  t,
  placePicker,
  setPlacePicker,
  placeSearch,
  setPlaceSearch,
  filteredPickerPlaces,
  patchSlotField,
}) {
  if (!placePicker) return null;

  return (
    <>
      <div
        className="ai-planner-sheet-overlay"
        role="presentation"
        onClick={() => setPlacePicker(null)}
      />
      <div
        className="ai-planner-sheet ai-planner-sheet--picker"
        role="dialog"
        aria-modal="true"
        aria-label={t('aiPlanner', 'editPlace')}
      >
        <h3>{t('aiPlanner', 'editPlace')}</h3>
        <div className="ai-planner-field">
          <label htmlFor="ai-place-search">{t('placeDiscover', 'searchPlaceholder')}</label>
          <input
            id="ai-place-search"
            type="search"
            value={placeSearch}
            onChange={(e) => setPlaceSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <ul className="ai-planner-picker-list">
          {filteredPickerPlaces.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="ai-planner-picker-item"
                onClick={() => {
                  patchSlotField(placePicker.messageIndex, placePicker.slotIndex, {
                    placeId: String(p.id),
                    reason: null,
                  });
                  setPlacePicker(null);
                }}
              >
                <span className="ai-planner-picker-item__name">{p.name}</span>
                {p.category && (
                  <span className="ai-planner-picker-item__cat">{p.category}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="ai-planner-sheet-close" onClick={() => setPlacePicker(null)}>
          {t('placeDiscover', 'modalClose')}
        </button>
      </div>
    </>
  );
}
