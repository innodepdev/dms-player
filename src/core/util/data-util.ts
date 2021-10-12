export function IntValue(data: string, defaultValue: number = 0) {
  let rslt: number = defaultValue;
  try {
    if (data) {
      rslt = Number(data);
    }
  } catch (error) {
    // unused
  }

  return rslt;
}

export function StringValue(data: string, defaultValue: string = '') {
  let rslt: string = defaultValue;
  try {
    if (data) {
      rslt = data;
    }
  } catch (error) {
    // unused
  }

  return rslt;
}

export function PromiseWait(duration: number) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, duration);
  });
}
