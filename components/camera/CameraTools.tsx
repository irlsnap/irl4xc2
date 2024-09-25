import { SafeAreaView, View } from "react-native";
import IconButton from "./IconButton";
import { ThemedText } from "../shared/ThemedText";

interface CameraToolsProps {
  cameraTorch: boolean;
  setCameraFacing: React.Dispatch<React.SetStateAction<"front" | "back">>;
  setCameraTorch: React.Dispatch<React.SetStateAction<boolean>>;
}
export default function CameraTools({
  cameraTorch,
  setCameraFacing,
  setCameraTorch,
}: CameraToolsProps) {
  return (
    <SafeAreaView
      style={{
        position: "absolute",
        right: "10%",
        zIndex: 1,
        gap: 26,
      }}
    >
      <IconButton
        onPress={() => setCameraTorch((prevValue) => !prevValue)}
        iosName={
          cameraTorch ? "flashlight.off.circle" : "flashlight.slash.circle"
        }
        androidName="flash"
        width={50}
        height={42}
      />
      <IconButton
        onPress={() =>
          setCameraFacing((prevValue) =>
            prevValue === "back" ? "front" : "back"
          )
        }
        iosName={"arrow.triangle.2.circlepath.camera"}
        androidName="close"
        width={50}
        height={42}
      />
    </SafeAreaView>
  );
}