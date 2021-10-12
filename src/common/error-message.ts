export enum ErrorCode {
  None = 0,
  createVideo = 10001,    // 비디오 생성 실패
  ptzMode,      // 재생 중 이 아닐 때, 소켓 disconnect 상태 에서 커맨드 처리 불가
}
