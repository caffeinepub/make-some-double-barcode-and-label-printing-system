import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";

module {
  // Old LabelConfig type (without new layout persistence fields)
  type OldLabelConfig = {
    width : Nat;
    height : Nat;
    margin : Nat;
    barcodeType : Text;
    customText : Text;
    textSize : Nat;
    font : Text;
  };

  // Old Actor
  type OldActor = {
    userProfiles : Map.Map<Principal, { name : Text; role : Text }>;
    labelConfigs : Map.Map<Text, OldLabelConfig>;
    printers : Map.Map<Text, { name : Text; connectionType : Text; status : Text }>;
    printHistory : [{ timestamp : Int; serialNumber : Text; labelType : Text; printer : Text }];
    errorLogs : [{ timestamp : Int; errorMessage : Text; printer : ?Text }];
    labelCounters : Map.Map<Text, Nat>;
    prefixesList : List.List<Text>;
    titleMappingsList : List.List<{ prefix : Text; title : Text }>;
    authenticatedSessions : Map.Map<Principal, Bool>;
  };

  // New LabelConfig type (with persistent layout fields)
  type NewLabelConfig = {
    width : Nat;
    height : Nat;
    margin : Nat;
    barcodeType : Text;
    customText : Text;
    textSize : Nat;
    font : Text;
    barcodePositionX : Nat;
    barcodePositionY : Nat;
    textPositionX : Nat;
    textPositionY : Nat;
    barcodeHeight : Nat;
    barcodeWidthScale : Nat;
    horizontalSpacing : Nat;
    centerContents : Bool;
  };

  // New Actor
  type NewActor = {
    userProfiles : Map.Map<Principal, { name : Text; role : Text }>;
    labelConfigs : Map.Map<Text, NewLabelConfig>;
    printers : Map.Map<Text, { name : Text; connectionType : Text; status : Text }>;
    printHistory : [{ timestamp : Int; serialNumber : Text; labelType : Text; printer : Text }];
    errorLogs : [{ timestamp : Int; errorMessage : Text; printer : ?Text }];
    labelCounters : Map.Map<Text, Nat>;
    prefixesList : List.List<Text>;
    titleMappingsList : List.List<{ prefix : Text; title : Text }>;
    authenticatedSessions : Map.Map<Principal, Bool>;
  };

  public func run(old : OldActor) : NewActor {
    let newLabelConfigs = old.labelConfigs.map<Text, OldLabelConfig, NewLabelConfig>(
      func(_key, oldConfig) {
        {
          width = oldConfig.width;
          height = oldConfig.height;
          margin = oldConfig.margin;
          barcodeType = oldConfig.barcodeType;
          customText = oldConfig.customText;
          textSize = oldConfig.textSize;
          font = oldConfig.font;
          barcodePositionX = 0;
          barcodePositionY = 0;
          textPositionX = 0;
          textPositionY = 0;
          barcodeHeight = 0;
          barcodeWidthScale = 0;
          horizontalSpacing = 0;
          centerContents = false;
        };
      }
    );
    { old with labelConfigs = newLabelConfigs };
  };
};
