export function validateLog(body: any): string | null {
  const { id, exerciseId, timestamp, weight, reps, sets, notes } = body || {};

  if (typeof id !== 'string' || id.trim() === '' || id.length > 100) {
    return "Invalid ID: must be a non-empty string <= 100 chars";
  }

  if (typeof exerciseId !== 'string' || exerciseId.trim() === '' || exerciseId.length > 100) {
    return "Invalid Exercise ID: must be a non-empty string <= 100 chars";
  }

  if (typeof timestamp !== 'number' || timestamp < 0) {
    return "Invalid timestamp: must be a non-negative number";
  }

  if (typeof weight !== 'number' || weight < 0) {
    return "Invalid weight: must be a non-negative number";
  }

  if (typeof reps !== 'number' || reps < 0) {
    return "Invalid reps: must be a non-negative number";
  }

  if (sets !== undefined && (typeof sets !== 'number' || sets < 0)) {
    return "Invalid sets: must be a non-negative number";
  }

  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 1000)) {
    return "Invalid notes: must be a string <= 1000 chars";
  }

  return null;
}

export function validateDelete(body: any): string | null {
  const { id, exerciseId } = body || {};

  if (!id && !exerciseId) {
    return "Missing ID or Exercise ID";
  }

  if (id && (typeof id !== 'string' || id.length > 100)) {
    return "Invalid ID";
  }

  if (exerciseId && (typeof exerciseId !== 'string' || exerciseId.length > 100)) {
    return "Invalid Exercise ID";
  }

  return null;
}
